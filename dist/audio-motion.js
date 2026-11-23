(function (root) {
  'use strict';

  var SOUND_MODES = {
    ratchet: true,
    wood: true,
    mute: true
  };

  var SENSITIVITY_THRESHOLDS = {
    sensitive: 2.35,
    normal: 3.55,
    steady: 5.15
  };

  var DEFAULT_COOLDOWN_MS = 1400;
  var DEFAULT_REARM_TIMEOUT_MS = 520;
  var POST_SPIN_GRACE_MS = 380;
  var REARM_HYSTERESIS_RATIO = 0.52;
  var SPIKE_OVERRIDE_RATIO = 1.25;
  var CONFIRM_RATIO = 0.88;
  var CONFIRM_WINDOW_MS = 160;
  var MAX_ACTIVE_VOICES = 18;
  var MAX_SUSPENDED_QUEUED = 2;

  var audioCtx = null;
  var masterGain = null;
  var masterCompressor = null;
  var noiseBuffer = null;

  var soundMode = 'ratchet';
  var lastActiveSoundMode = 'ratchet';
  var mutedFlag = false;
  var activeVoices = 0;
  var suspendedQueued = 0;

  function getAudioContextCtor() {
    if (!root) {
      return null;
    }
    return root.AudioContext || root.webkitAudioContext || null;
  }

  function buildNoiseBuffer(ctx) {
    if (!ctx || typeof ctx.createBuffer !== 'function') {
      return null;
    }
    try {
      var sampleRate = ctx.sampleRate || 44100;
      var length = Math.max(1, Math.floor(sampleRate * 0.06));
      var buffer = ctx.createBuffer(1, length, sampleRate);
      var data = buffer.getChannelData(0);
      var i;
      for (i = 0; i < length; i += 1) {
        data[i] = Math.random() * 2 - 1;
      }
      return buffer;
    } catch (e) {
      return null;
    }
  }

  function isEffectivelyMuted() {
    return mutedFlag || soundMode === 'mute';
  }

  function syncMasterGain() {
    if (!audioCtx || !masterGain || !masterGain.gain) {
      return;
    }
    var target = isEffectivelyMuted() ? 0 : 0.88;
    var now = typeof audioCtx.currentTime === 'number' ? audioCtx.currentTime : 0;
    try {
      if (target === 0 && typeof masterGain.gain.setTargetAtTime === 'function') {
        masterGain.gain.setTargetAtTime(0, now, 0.01);
      } else if (typeof masterGain.gain.setValueAtTime === 'function') {
        masterGain.gain.setValueAtTime(target, now);
      } else {
        masterGain.gain.value = target;
      }
    } catch (e) {
      try {
        masterGain.gain.value = target;
      } catch (err) {}
    }
  }

  function setupMasterBus(ctx) {
    try {
      masterGain = ctx.createGain();
      masterGain.gain.value = isEffectivelyMuted() ? 0 : 0.88;
      masterGain.connect(ctx.destination);
    } catch (e) {
      masterGain = null;
      masterCompressor = null;
      return;
    }

    if (typeof ctx.createDynamicsCompressor === 'function') {
      try {
        masterCompressor = ctx.createDynamicsCompressor();
        masterCompressor.threshold.value = -16;
        masterCompressor.knee.value = 14;
        masterCompressor.ratio.value = 6;
        masterCompressor.attack.value = 0.002;
        masterCompressor.release.value = 0.12;
        masterCompressor.connect(masterGain);
      } catch (e) {
        masterCompressor = null;
      }
    }
  }

  function getOutputNode(ctx) {
    return masterCompressor || masterGain || ctx.destination;
  }

  function ensureContext() {
    var AudioCtx = getAudioContextCtor();
    if (!AudioCtx) {
      return null;
    }

    if (audioCtx && audioCtx.state === 'closed') {
      audioCtx = null;
      masterGain = null;
      masterCompressor = null;
      noiseBuffer = null;
      activeVoices = 0;
      suspendedQueued = 0;
    }

    if (!audioCtx) {
      try {
        audioCtx = new AudioCtx();
      } catch (e) {
        audioCtx = null;
        return null;
      }
      setupMasterBus(audioCtx);
      noiseBuffer = buildNoiseBuffer(audioCtx);
    }

    return audioCtx;
  }

  function tryResume(ctx) {
    if (!ctx || typeof ctx.resume !== 'function') {
      return;
    }
    if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
      try {
        var res = ctx.resume();
        if (res && typeof res.catch === 'function') {
          res.catch(function () {});
        }
      } catch (e) {}
    }
  }

  function unlock() {
    var ctx = ensureContext();
    if (!ctx) {
      return false;
    }

    tryResume(ctx);

    if (ctx.state === 'running') {
      suspendedQueued = 0;
    } else if (
      typeof ctx.createBuffer === 'function' &&
      typeof ctx.createBufferSource === 'function' &&
      typeof ctx.createGain === 'function'
    ) {
      try {
        var silentBuffer = ctx.createBuffer(1, 1, ctx.sampleRate || 44100);
        var silentSrc = ctx.createBufferSource();
        silentSrc.buffer = silentBuffer;
        var silentGain = ctx.createGain();
        silentGain.gain.value = 0;
        silentSrc.connect(silentGain);
        silentGain.connect(ctx.destination);
        silentSrc.onended = function () {
          try {
            silentSrc.disconnect();
            silentGain.disconnect();
          } catch (err) {}
        };
        silentSrc.start(0);
      } catch (e) {}
    }

    return true;
  }

  function clamp01(val, fallback) {
    if (typeof val !== 'number' || !Number.isFinite(val)) {
      return fallback;
    }
    if (val < 0) {
      return 0;
    }
    if (val > 1) {
      return 1;
    }
    return val;
  }

  function canScheduleVoice() {
    var ctx = ensureContext();
    if (!ctx || typeof ctx.createOscillator !== 'function' || typeof ctx.createGain !== 'function') {
      return null;
    }

    if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
      tryResume(ctx);
      if (suspendedQueued >= MAX_SUSPENDED_QUEUED) {
        return null;
      }
      suspendedQueued += 1;
    } else {
      suspendedQueued = 0;
    }

    if (activeVoices >= MAX_ACTIVE_VOICES) {
      return null;
    }

    return ctx;
  }

  function playRatchetTick(ctx, ratio) {
    var now = typeof ctx.currentTime === 'number' ? ctx.currentTime : 0;
    var nodes = [];
    var cleaned = false;
    var fallbackTimer = null;
    var duration = 0.042;
    var amp = 0.56 + ratio * 0.34;

    function cleanup() {
      if (cleaned) {
        return;
      }
      cleaned = true;
      if (fallbackTimer !== null) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      if (activeVoices > 0) {
        activeVoices -= 1;
      }
      var i;
      for (i = 0; i < nodes.length; i += 1) {
        try {
          nodes[i].disconnect();
        } catch (err) {}
      }
      nodes.length = 0;
    }

    try {
      activeVoices += 1;

      var voiceGain = ctx.createGain();
      voiceGain.gain.setValueAtTime(1, now);
      voiceGain.connect(getOutputNode(ctx));
      nodes.push(voiceGain);

      // Sharp mechanical pawl snap.
      var snapOsc = ctx.createOscillator();
      var snapGain = ctx.createGain();
      snapOsc.type = 'triangle';
      snapOsc.frequency.setValueAtTime(860 + ratio * 420, now);
      snapOsc.frequency.exponentialRampToValueAtTime(210 + ratio * 90, now + 0.018);
      snapGain.gain.setValueAtTime(0.0001, now);
      snapGain.gain.linearRampToValueAtTime(0.48 * amp, now + 0.0012);
      snapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.024);
      snapGain.gain.linearRampToValueAtTime(0, now + duration);
      snapOsc.connect(snapGain);
      snapGain.connect(voiceGain);
      nodes.push(snapOsc, snapGain);

      // Subtle metallic spring overtone.
      var ringOsc = ctx.createOscillator();
      var ringGain = ctx.createGain();
      ringOsc.type = 'sine';
      ringOsc.frequency.setValueAtTime(2450 + ratio * 750, now);
      ringOsc.frequency.exponentialRampToValueAtTime(1650 + ratio * 350, now + 0.022);
      ringGain.gain.setValueAtTime(0.0001, now);
      ringGain.gain.linearRampToValueAtTime(0.16 * amp, now + 0.001);
      ringGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.022);
      ringGain.gain.linearRampToValueAtTime(0, now + 0.030);
      ringOsc.connect(ringGain);
      ringGain.connect(voiceGain);
      nodes.push(ringOsc, ringGain);

      // Filtered click burst.
      var noiseSrc = null;
      if (noiseBuffer && typeof ctx.createBufferSource === 'function') {
        noiseSrc = ctx.createBufferSource();
        noiseSrc.buffer = noiseBuffer;
        var noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.0001, now);
        noiseGain.gain.linearRampToValueAtTime(0.42 * amp, now + 0.0008);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.014);
        noiseGain.gain.linearRampToValueAtTime(0, now + 0.020);

        if (typeof ctx.createBiquadFilter === 'function') {
          var bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.setValueAtTime(2200 + ratio * 1200, now);
          bp.Q.setValueAtTime(2.4, now);
          noiseSrc.connect(bp);
          bp.connect(noiseGain);
          nodes.push(bp);
        } else {
          noiseSrc.connect(noiseGain);
        }
        noiseGain.connect(voiceGain);
        nodes.push(noiseSrc, noiseGain);
      }

      snapOsc.onended = cleanup;
      fallbackTimer = setTimeout(cleanup, 160);

      snapOsc.start(now);
      ringOsc.start(now);
      snapOsc.stop(now + duration + 0.005);
      ringOsc.stop(now + 0.032);
      if (noiseSrc) {
        noiseSrc.start(now);
        noiseSrc.stop(now + 0.022);
      }

      return true;
    } catch (e) {
      cleanup();
      return false;
    }
  }

  function playWoodTick(ctx, ratio) {
    var now = typeof ctx.currentTime === 'number' ? ctx.currentTime : 0;
    var nodes = [];
    var cleaned = false;
    var fallbackTimer = null;
    var duration = 0.068;
    var amp = 0.58 + ratio * 0.30;

    function cleanup() {
      if (cleaned) {
        return;
      }
      cleaned = true;
      if (fallbackTimer !== null) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      if (activeVoices > 0) {
        activeVoices -= 1;
      }
      var i;
      for (i = 0; i < nodes.length; i += 1) {
        try {
          nodes[i].disconnect();
        } catch (err) {}
      }
      nodes.length = 0;
    }

    try {
      activeVoices += 1;

      var voiceGain = ctx.createGain();
      voiceGain.gain.setValueAtTime(1, now);
      voiceGain.connect(getOutputNode(ctx));
      nodes.push(voiceGain);

      // Warm wooden body resonance.
      var bodyOsc = ctx.createOscillator();
      var bodyGain = ctx.createGain();
      bodyOsc.type = 'sine';
      bodyOsc.frequency.setValueAtTime(840 + ratio * 240, now);
      bodyOsc.frequency.exponentialRampToValueAtTime(490 + ratio * 110, now + 0.016);
      bodyGain.gain.setValueAtTime(0.0001, now);
      bodyGain.gain.linearRampToValueAtTime(0.56 * amp, now + 0.0015);
      bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);
      bodyGain.gain.linearRampToValueAtTime(0, now + duration);
      bodyOsc.connect(bodyGain);
      bodyGain.connect(voiceGain);
      nodes.push(bodyOsc, bodyGain);

      // Crisp woody harmonic knock.
      var harmOsc = ctx.createOscillator();
      var harmGain = ctx.createGain();
      harmOsc.type = 'sine';
      harmOsc.frequency.setValueAtTime(1480 + ratio * 340, now);
      harmOsc.frequency.exponentialRampToValueAtTime(1260 + ratio * 220, now + 0.014);
      harmGain.gain.setValueAtTime(0.0001, now);
      harmGain.gain.linearRampToValueAtTime(0.24 * amp, now + 0.0012);
      harmGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.032);
      harmGain.gain.linearRampToValueAtTime(0, now + 0.040);
      harmOsc.connect(harmGain);
      harmGain.connect(voiceGain);
      nodes.push(harmOsc, harmGain);

      // Soft pick transient.
      var noiseSrc = null;
      if (noiseBuffer && typeof ctx.createBufferSource === 'function') {
        noiseSrc = ctx.createBufferSource();
        noiseSrc.buffer = noiseBuffer;
        var noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.0001, now);
        noiseGain.gain.linearRampToValueAtTime(0.26 * amp, now + 0.001);
        noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.012);
        noiseGain.gain.linearRampToValueAtTime(0, now + 0.018);

        if (typeof ctx.createBiquadFilter === 'function') {
          var bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.frequency.setValueAtTime(1650 + ratio * 450, now);
          bp.Q.setValueAtTime(2.8, now);
          noiseSrc.connect(bp);
          bp.connect(noiseGain);
          nodes.push(bp);
        } else {
          noiseSrc.connect(noiseGain);
        }
        noiseGain.connect(voiceGain);
        nodes.push(noiseSrc, noiseGain);
      }

      bodyOsc.onended = cleanup;
      fallbackTimer = setTimeout(cleanup, 180);

      bodyOsc.start(now);
      harmOsc.start(now);
      bodyOsc.stop(now + duration + 0.005);
      harmOsc.stop(now + 0.042);
      if (noiseSrc) {
        noiseSrc.start(now);
        noiseSrc.stop(now + 0.020);
      }

      return true;
    } catch (e) {
      cleanup();
      return false;
    }
  }

  function playTick(speedRatio) {
    if (isEffectivelyMuted()) {
      return false;
    }

    var ctx = canScheduleVoice();
    if (!ctx) {
      return false;
    }

    var ratio = clamp01(speedRatio, 0.5);
    if (soundMode === 'wood') {
      return playWoodTick(ctx, ratio);
    }
    return playRatchetTick(ctx, ratio);
  }

  function playWin() {
    if (isEffectivelyMuted()) {
      return false;
    }

    var ctx = canScheduleVoice();
    if (!ctx) {
      return false;
    }

    var notes = [523.25, 659.25, 783.99, 1046.50]; // C5 - E5 - G5 - C6
    var stepOffset = 0.068;
    var now = typeof ctx.currentTime === 'number' ? ctx.currentTime : 0;
    var nodes = [];
    var cleaned = false;
    var fallbackTimer = null;

    function cleanup() {
      if (cleaned) {
        return;
      }
      cleaned = true;
      if (fallbackTimer !== null) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      if (activeVoices > 0) {
        activeVoices -= 1;
      }
      var i;
      for (i = 0; i < nodes.length; i += 1) {
        try {
          nodes[i].disconnect();
        } catch (err) {}
      }
      nodes.length = 0;
    }

    try {
      activeVoices += 1;

      var voiceGain = ctx.createGain();
      voiceGain.gain.setValueAtTime(1, now);
      voiceGain.connect(getOutputNode(ctx));
      nodes.push(voiceGain);

      var lastOsc = null;
      var i;
      for (i = 0; i < notes.length; i += 1) {
        var t0 = now + i * stepOffset;
        var noteDecay = i === notes.length - 1 ? 0.48 : 0.24;
        var notePeak = i === notes.length - 1 ? 0.34 : 0.24;

        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = soundMode === 'wood' ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(notes[i], t0);

        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.linearRampToValueAtTime(notePeak, t0 + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + noteDecay);
        gain.gain.linearRampToValueAtTime(0, t0 + noteDecay + 0.02);

        osc.connect(gain);
        gain.connect(voiceGain);
        nodes.push(osc, gain);

        osc.start(t0);
        osc.stop(t0 + noteDecay + 0.025);
        lastOsc = osc;

        // Soft octave sparkle on final tonic note.
        if (i === notes.length - 1) {
          var shimmerOsc = ctx.createOscillator();
          var shimmerGain = ctx.createGain();
          shimmerOsc.type = 'sine';
          shimmerOsc.frequency.setValueAtTime(notes[i] * 2, t0);
          shimmerGain.gain.setValueAtTime(0.0001, t0);
          shimmerGain.gain.linearRampToValueAtTime(0.09, t0 + 0.018);
          shimmerGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.36);
          shimmerGain.gain.linearRampToValueAtTime(0, t0 + 0.38);
          shimmerOsc.connect(shimmerGain);
          shimmerGain.connect(voiceGain);
          nodes.push(shimmerOsc, shimmerGain);
          shimmerOsc.start(t0);
          shimmerOsc.stop(t0 + 0.39);
        }
      }

      if (lastOsc) {
        lastOsc.onended = cleanup;
      }
      fallbackTimer = setTimeout(cleanup, 950);
      return true;
    } catch (e) {
      cleanup();
      return false;
    }
  }

  function setSoundMode(mode) {
    if (SOUND_MODES[mode]) {
      soundMode = mode;
      if (mode === 'mute') {
        mutedFlag = true;
      } else {
        lastActiveSoundMode = mode;
        mutedFlag = false;
      }
      syncMasterGain();
    }
    return soundMode;
  }

  function getSoundMode() {
    if (mutedFlag) {
      return 'mute';
    }
    return soundMode;
  }

  function setMuted(muted) {
    mutedFlag = Boolean(muted);
    if (!mutedFlag && soundMode === 'mute') {
      soundMode = lastActiveSoundMode || 'ratchet';
    }
    syncMasterGain();
    return isEffectivelyMuted();
  }

  function isMuted() {
    return isEffectivelyMuted();
  }

  function resolveSensitivity(level) {
    if (level === 'sensitive' || level === 'normal' || level === 'steady') {
      return level;
    }
    return 'normal';
  }

  function createShakeDetector(options) {
    var opts = (options && typeof options === 'object') ? options : {};
    var sensitivity = resolveSensitivity(opts.sensitivity);
    var threshold = SENSITIVITY_THRESHOLDS[sensitivity];
    var cooldownMs = (typeof opts.cooldownMs === 'number' && Number.isFinite(opts.cooldownMs) && opts.cooldownMs >= 0)
      ? opts.cooldownMs
      : DEFAULT_COOLDOWN_MS;
    var rearmTimeoutMs = (typeof opts.rearmTimeoutMs === 'number' && Number.isFinite(opts.rearmTimeoutMs) && opts.rearmTimeoutMs >= 0)
      ? opts.rearmTimeoutMs
      : DEFAULT_REARM_TIMEOUT_MS;
    var onShake = typeof opts.onShake === 'function' ? opts.onShake : null;
    var onMotion = typeof opts.onMotion === 'function' ? opts.onMotion : null;

    var armed = true;
    var spinning = Boolean(opts.isSpinning);
    var lastShakeAt = -Infinity;
    var lastSpinEndedAt = -Infinity;
    var lastElevatedAt = -Infinity;
    var lastSpeed = 0;
    var motionStrength = 0;

    function notifyMotion(value) {
      if (onMotion) {
        try {
          onMotion(value);
        } catch (e) {}
      }
    }

    function setSensitivity(level) {
      if (level === 'sensitive' || level === 'normal' || level === 'steady') {
        sensitivity = level;
        threshold = SENSITIVITY_THRESHOLDS[level];
      }
      return sensitivity;
    }

    function getSensitivity() {
      return sensitivity;
    }

    function getThreshold() {
      return threshold;
    }

    function setSpinning(flag) {
      var next = Boolean(flag);
      if (spinning && !next) {
        lastSpinEndedAt = Date.now();
        armed = false;
        lastElevatedAt = -Infinity;
      }
      spinning = next;
      return spinning;
    }

    function isSpinning() {
      return spinning;
    }

    function setOnShake(cb) {
      onShake = typeof cb === 'function' ? cb : null;
    }

    function setOnMotion(cb) {
      onMotion = typeof cb === 'function' ? cb : null;
    }

    function getMotionStrength() {
      return motionStrength;
    }

    function getLastSpeed() {
      return lastSpeed;
    }

    function reset() {
      armed = true;
      lastShakeAt = -Infinity;
      lastSpinEndedAt = -Infinity;
      lastElevatedAt = -Infinity;
      lastSpeed = 0;
      motionStrength = 0;
    }

    function feedGyro(sample, spinningOverride) {
      if (!sample || typeof sample !== 'object') {
        return false;
      }

      var x = Number(sample.x);
      var y = Number(sample.y);
      var z = Number(sample.z);
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        return false;
      }

      if (typeof spinningOverride === 'boolean') {
        setSpinning(spinningOverride);
      }

      var mag = Math.sqrt(x * x + y * y + z * z);
      if (!Number.isFinite(mag)) {
        return false;
      }

      lastSpeed = mag;

      var rawStrength = threshold > 0 ? (mag / threshold) : 0;
      if (rawStrength < 0) {
        rawStrength = 0;
      } else if (rawStrength > 1) {
        rawStrength = 1;
      }

      var alpha = rawStrength >= motionStrength ? 0.65 : 0.30;
      motionStrength = motionStrength + alpha * (rawStrength - motionStrength);
      if (rawStrength === 0 && motionStrength < 0.008) {
        motionStrength = 0;
      }
      if (motionStrength < 0) {
        motionStrength = 0;
      } else if (motionStrength > 1) {
        motionStrength = 1;
      }

      notifyMotion(motionStrength);

      if (spinning) {
        lastElevatedAt = -Infinity;
        return false;
      }

      var now = Date.now();
      if (lastShakeAt !== -Infinity && now < lastShakeAt) {
        lastShakeAt = -Infinity;
      }
      if (lastSpinEndedAt !== -Infinity && now < lastSpinEndedAt) {
        lastSpinEndedAt = -Infinity;
      }

      if (lastSpinEndedAt !== -Infinity && (now - lastSpinEndedAt) < POST_SPIN_GRACE_MS) {
        return false;
      }

      var elapsed = now - lastShakeAt;

      if (!armed) {
        if (mag < threshold * REARM_HYSTERESIS_RATIO || elapsed >= rearmTimeoutMs) {
          armed = true;
        }
      }

      if (!armed || elapsed < cooldownMs) {
        return false;
      }

      // Confirmation gate: either a strong single flick or two elevated samples in quick succession.
      var confirmed = false;
      if (mag >= threshold * SPIKE_OVERRIDE_RATIO) {
        confirmed = true;
      } else if (mag >= threshold * CONFIRM_RATIO) {
        if (lastElevatedAt !== -Infinity && (now - lastElevatedAt) <= CONFIRM_WINDOW_MS && mag >= threshold) {
          confirmed = true;
        } else {
          lastElevatedAt = now;
        }
      } else {
        lastElevatedAt = -Infinity;
      }

      if (!confirmed) {
        return false;
      }

      armed = false;
      lastShakeAt = now;
      lastElevatedAt = -Infinity;

      var normalizedPower = threshold > 0 ? (mag - threshold) / (threshold * 1.4) : 0;
      if (normalizedPower < 0) {
        normalizedPower = 0;
      } else if (normalizedPower > 1) {
        normalizedPower = 1;
      }
      var suggestedSpeed = Math.round(460 + normalizedPower * 440);

      if (onShake) {
        try {
          onShake({
            speed: mag,
            strength: motionStrength,
            power: normalizedPower,
            suggestedSpeed: suggestedSpeed
          });
        } catch (e) {}
      }

      return true;
    }

    return {
      setSensitivity: setSensitivity,
      getSensitivity: getSensitivity,
      getThreshold: getThreshold,
      setSpinning: setSpinning,
      isSpinning: isSpinning,
      setOnShake: setOnShake,
      setOnMotion: setOnMotion,
      feedGyro: feedGyro,
      getMotionStrength: getMotionStrength,
      getLastSpeed: getLastSpeed,
      reset: reset
    };
  }

  var defaultDetector = createShakeDetector();

  var api = {
    unlock: unlock,
    playTick: playTick,
    playWin: playWin,
    setSoundMode: setSoundMode,
    getSoundMode: getSoundMode,
    setMuted: setMuted,
    isMuted: isMuted,
    createShakeDetector: createShakeDetector,
    setSensitivity: defaultDetector.setSensitivity,
    getSensitivity: defaultDetector.getSensitivity,
    getThreshold: defaultDetector.getThreshold,
    setSpinning: defaultDetector.setSpinning,
    isSpinning: defaultDetector.isSpinning,
    setOnShake: defaultDetector.setOnShake,
    setOnMotion: defaultDetector.setOnMotion,
    feedGyro: defaultDetector.feedGyro,
    getMotionStrength: defaultDetector.getMotionStrength,
    getLastSpeed: defaultDetector.getLastSpeed,
    resetGyro: defaultDetector.reset
  };

  if (root) {
    root.WheelAudioMotion = api;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : null));
