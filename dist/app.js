(function () {
  'use strict';

  var STORAGE_KEY = 'xhs_spin_wheel_state_v1';
  var MAX_HISTORY = 20;

  var dom = {};
  var bridgeInfo = {
    initialized: false,
    inContainer: false,
    capabilities: {}
  };

  var state = {
    theme: 'light',
    soundMode: 'ratchet',
    lastActiveSoundMode: 'ratchet',
    vibrateEnabled: true,
    shakeEnabled: true,
    shakeSensitivity: 'normal',
    activeSceneId: 'eat',
    presetOverrides: {},
    customScenes: [],
    excludeMode: false,
    excludedMap: {},
    history: [],
    decisionCounter: 0
  };

  var wheel = null;
  var currentWheelItems = [];
  var isSpinning = false;
  var pendingWheelSyncAfterResult = false;
  var tickAnimAlt = false;
  var tickResetTimer = null;
  var toastTimer = null;
  var saveTimer = null;

  var activeModalEl = null;
  var lastFocusedEl = null;
  var lastBackdropDownEl = null;
  var supportsDialog = false;

  var currentResultRecord = null;
  var currentPosterCanvas = null;
  var posterActionBusy = false;

  var editorDraft = null;

  var shakeRuntimeActive = false;
  var gyroStopping = false;

  var confettiRaf = null;
  var confettiParticles = [];

  var reducedMotionQuery = null;

  function byId(id) {
    return document.getElementById(id);
  }

  function setElementHidden(el, shouldHide) {
    if (!el) {
      return;
    }
    var hide = Boolean(shouldHide);
    if (hide) {
      el.setAttribute('hidden', '');
    } else {
      el.removeAttribute('hidden');
    }
    if ('hidden' in el) {
      try {
        el.hidden = hide;
      } catch (e) {}
    }
  }

  function supportsFlexGap() {
    if (!document.body) {
      return false;
    }
    var flex = document.createElement('div');
    flex.style.position = 'absolute';
    flex.style.visibility = 'hidden';
    flex.style.display = 'flex';
    flex.style.flexDirection = 'column';
    flex.style.rowGap = '1px';
    flex.appendChild(document.createElement('div'));
    flex.appendChild(document.createElement('div'));
    document.body.appendChild(flex);
    var supported = flex.scrollHeight === 1;
    if (flex.parentNode) {
      flex.parentNode.removeChild(flex);
    }
    return supported;
  }

  function updateAppHeight() {
    var vh = window.visualViewport && typeof window.visualViewport.height === 'number'
      ? window.visualViewport.height
      : window.innerHeight;
    if (typeof vh === 'number' && vh > 0 && document.documentElement && document.documentElement.style) {
      document.documentElement.style.setProperty('--app-height', Math.round(vh) + 'px');
    }
  }

  function prefersReducedMotion() {
    return !!(reducedMotionQuery && reducedMotionQuery.matches);
  }

  function initMediaQueries() {
    if (typeof window.matchMedia !== 'function') {
      return;
    }
    try {
      reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    } catch (e) {
      reducedMotionQuery = null;
    }
  }

  function formatDateTime(ts) {
    var d = new Date(typeof ts === 'number' ? ts : Date.now());
    var y = String(d.getFullYear());
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    return y + '-' + m + '-' + day + ' ' + hh + ':' + mm;
  }

  function formatShortDate(ts) {
    var d = new Date(typeof ts === 'number' ? ts : Date.now());
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    return m + '-' + day + ' ' + hh + ':' + mm;
  }

  function formatDecisionNo(num) {
    var safeNum = typeof num === 'number' && Number.isFinite(num) && num > 0 ? Math.floor(num) : 1;
    return 'NO.' + String(safeNum).padStart(3, '0');
  }

  function showToast(message) {
    if (!dom.toast || !message) {
      return;
    }
    dom.toast.textContent = String(message);
    dom.toast.hidden = false;
    if (toastTimer !== null) {
      clearTimeout(toastTimer);
    }
    toastTimer = setTimeout(function () {
      dom.toast.hidden = true;
      toastTimer = null;
    }, 2600);
  }

  function scheduleSaveState() {
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
    }
    saveTimer = setTimeout(function () {
      saveTimer = null;
      persistStateNow();
    }, 180);
  }

  function persistStateNow() {
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    if (!window.XhsBridge || typeof window.XhsBridge.saveState !== 'function') {
      return;
    }
    var payload = {
      theme: state.theme,
      soundMode: state.soundMode,
      lastActiveSoundMode: state.lastActiveSoundMode,
      vibrateEnabled: state.vibrateEnabled,
      shakeEnabled: state.shakeEnabled,
      shakeSensitivity: state.shakeSensitivity,
      activeSceneId: state.activeSceneId,
      presetOverrides: state.presetOverrides,
      customScenes: state.customScenes,
      excludeMode: state.excludeMode,
      excludedMap: state.excludedMap,
      history: state.history,
      decisionCounter: state.decisionCounter
    };
    var savePromise = window.XhsBridge.saveState(STORAGE_KEY, payload);
    if (savePromise && typeof savePromise.catch === 'function') {
      savePromise.catch(function () {});
    }
  }

  function sanitizeSavedState(raw) {
    if (!raw || typeof raw !== 'object') {
      return;
    }
    if (raw.theme === 'light' || raw.theme === 'dark') {
      state.theme = raw.theme;
    }
    if (raw.soundMode === 'ratchet' || raw.soundMode === 'wood' || raw.soundMode === 'mute') {
      state.soundMode = raw.soundMode;
    }
    if (raw.lastActiveSoundMode === 'ratchet' || raw.lastActiveSoundMode === 'wood') {
      state.lastActiveSoundMode = raw.lastActiveSoundMode;
    } else if (state.soundMode !== 'mute') {
      state.lastActiveSoundMode = state.soundMode;
    }
    if (typeof raw.vibrateEnabled === 'boolean') {
      state.vibrateEnabled = raw.vibrateEnabled;
    }
    if (typeof raw.shakeEnabled === 'boolean') {
      state.shakeEnabled = raw.shakeEnabled;
    }
    if (raw.shakeSensitivity === 'sensitive' || raw.shakeSensitivity === 'normal' || raw.shakeSensitivity === 'steady') {
      state.shakeSensitivity = raw.shakeSensitivity;
    }
    if (typeof raw.activeSceneId === 'string' && raw.activeSceneId) {
      state.activeSceneId = raw.activeSceneId;
    }
    if (typeof raw.excludeMode === 'boolean') {
      state.excludeMode = raw.excludeMode;
    }
    if (typeof raw.decisionCounter === 'number' && Number.isFinite(raw.decisionCounter) && raw.decisionCounter >= 0) {
      state.decisionCounter = Math.floor(raw.decisionCounter);
    }

    if (raw.presetOverrides && typeof raw.presetOverrides === 'object' && !Array.isArray(raw.presetOverrides)) {
      var cleanOverrides = {};
      var keys = Object.keys(raw.presetOverrides);
      for (var i = 0; i < keys.length; i += 1) {
        var key = keys[i];
        if (window.WheelPresets.getPresetById(key)) {
          var normalizedOverride = window.WheelPresets.normalizeScene(raw.presetOverrides[key]);
          normalizedOverride.id = key;
          normalizedOverride.isCustom = false;
          cleanOverrides[key] = normalizedOverride;
        }
      }
      state.presetOverrides = cleanOverrides;
    }

    if (Array.isArray(raw.customScenes)) {
      var cleanCustom = [];
      for (var j = 0; j < raw.customScenes.length; j += 1) {
        var entry = raw.customScenes[j];
        if (entry && typeof entry === 'object') {
          var normalizedCustom = window.WheelPresets.normalizeScene(entry);
          normalizedCustom.isCustom = true;
          cleanCustom.push(normalizedCustom);
        }
      }
      state.customScenes = cleanCustom;
    }

    if (raw.excludedMap && typeof raw.excludedMap === 'object' && !Array.isArray(raw.excludedMap)) {
      var cleanExcluded = {};
      var exKeys = Object.keys(raw.excludedMap);
      for (var k = 0; k < exKeys.length; k += 1) {
        var sceneKey = exKeys[k];
        var list = raw.excludedMap[sceneKey];
        if (Array.isArray(list)) {
          cleanExcluded[sceneKey] = list.filter(function (n) {
            return typeof n === 'number' && Number.isFinite(n) && n >= 0;
          });
        }
      }
      state.excludedMap = cleanExcluded;
    }

    if (Array.isArray(raw.history)) {
      state.history = raw.history.slice(0, MAX_HISTORY).filter(function (item) {
        return item && typeof item === 'object' && typeof item.label === 'string';
      });
    }
  }

  function getAllScenes() {
    var presets = window.WheelPresets.getPresets();
    var list = [];
    for (var i = 0; i < presets.length; i += 1) {
      var p = presets[i];
      if (state.presetOverrides[p.id]) {
        list.push(window.WheelPresets.cloneScene(state.presetOverrides[p.id]));
      } else {
        list.push(p);
      }
    }
    for (var j = 0; j < state.customScenes.length; j += 1) {
      list.push(window.WheelPresets.cloneScene(state.customScenes[j]));
    }
    return list;
  }

  function getActiveScene() {
    var scenes = getAllScenes();
    for (var i = 0; i < scenes.length; i += 1) {
      if (scenes[i].id === state.activeSceneId) {
        return scenes[i];
      }
    }
    state.activeSceneId = scenes[0].id;
    return scenes[0];
  }

  function getExcludedIndices(scene) {
    if (!scene || !Array.isArray(scene.items)) {
      return [];
    }
    var raw = state.excludedMap[scene.id];
    if (!Array.isArray(raw) || raw.length === 0) {
      return [];
    }
    var total = scene.items.length;
    var unique = [];
    for (var i = 0; i < raw.length; i += 1) {
      var idx = Math.floor(raw[i]);
      if (idx >= 0 && idx < total && unique.indexOf(idx) === -1) {
        unique.push(idx);
      }
    }
    while (total - unique.length < 2 && unique.length > 0) {
      unique.pop();
    }
    state.excludedMap[scene.id] = unique;
    return unique;
  }

  function applyTheme(theme) {
    var target = theme === 'dark' ? 'dark' : 'light';
    state.theme = target;

    var root = document.documentElement;
    if (target === 'dark') {
      root.classList.remove('theme-light');
      root.classList.add('theme-dark');
    } else {
      root.classList.remove('theme-dark');
      root.classList.add('theme-light');
    }

    if (dom.metaColorScheme) {
      dom.metaColorScheme.setAttribute('content', target);
    }

    if (dom.btnTheme) {
      var isDark = target === 'dark';
      dom.btnTheme.setAttribute('aria-pressed', isDark ? 'true' : 'false');
      dom.btnTheme.setAttribute('title', isDark ? '切换为晨雾暖白主题' : '切换为暮夜黑金主题');
      if (dom.iconThemeSun) {
        setElementHidden(dom.iconThemeSun, isDark);
      }
      if (dom.iconThemeMoon) {
        setElementHidden(dom.iconThemeMoon, !isDark);
      }
    }

    if (dom.btnSettingThemeLight && dom.btnSettingThemeDark) {
      var lightOn = target === 'light';
      dom.btnSettingThemeLight.classList.toggle('is-active', lightOn);
      dom.btnSettingThemeLight.setAttribute('aria-pressed', lightOn ? 'true' : 'false');
      dom.btnSettingThemeDark.classList.toggle('is-active', !lightOn);
      dom.btnSettingThemeDark.setAttribute('aria-pressed', !lightOn ? 'true' : 'false');
    }
  }

  function syncAudioUI() {
    var mode = state.soundMode;
    if (window.WheelAudioMotion) {
      window.WheelAudioMotion.setSoundMode(mode);
    }
    var muted = mode === 'mute';

    if (dom.btnSound) {
      dom.btnSound.setAttribute('aria-pressed', muted ? 'false' : 'true');
      dom.btnSound.classList.toggle('is-muted', muted);
      dom.btnSound.setAttribute('title', muted ? '已静音，点击开启音效' : '点击静音');
      if (dom.iconSoundOn) {
        setElementHidden(dom.iconSoundOn, muted);
      }
      if (dom.iconSoundOff) {
        setElementHidden(dom.iconSoundOff, !muted);
      }
    }

    var soundBtns = document.querySelectorAll('[data-sound-mode]');
    for (var i = 0; i < soundBtns.length; i += 1) {
      var btn = soundBtns[i];
      var active = btn.getAttribute('data-sound-mode') === mode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  }

  function syncSettingsUI() {
    var vibrateOn = Boolean(state.vibrateEnabled);
    if (dom.btnSettingVibrate) {
      dom.btnSettingVibrate.classList.toggle('is-on', vibrateOn);
      dom.btnSettingVibrate.setAttribute('aria-checked', vibrateOn ? 'true' : 'false');
      var vText = dom.btnSettingVibrate.querySelector('.toggle-state-text');
      if (vText) {
        vText.textContent = vibrateOn ? '开' : '关';
      }
    }
    if (dom.settingVibrateHint) {
      if (bridgeInfo.initialized && !bridgeInfo.capabilities.vibrate) {
        dom.settingVibrateHint.textContent = bridgeInfo.inContainer
          ? '当前客户端低于 9.50，暂不支持短震动'
          : '在小红书 App（9.50+）内可体验过线震动手感';
      } else {
        dom.settingVibrateHint.textContent = '过线微震手感，跟随指针同步触发';
      }
    }

    var shakeOn = Boolean(state.shakeEnabled);
    if (dom.btnSettingShake) {
      dom.btnSettingShake.classList.toggle('is-on', shakeOn);
      dom.btnSettingShake.setAttribute('aria-checked', shakeOn ? 'true' : 'false');
      var sText = dom.btnSettingShake.querySelector('.toggle-state-text');
      if (sText) {
        sText.textContent = shakeOn ? '开' : '关';
      }
    }
    if (dom.settingShakeHint) {
      if (bridgeInfo.initialized && !bridgeInfo.capabilities.gyroscope) {
        dom.settingShakeHint.textContent = bridgeInfo.inContainer
          ? '当前客户端低于 9.50 或硬件不支持陀螺仪'
          : '在小红书 App（9.50+）内可启用陀螺仪摇一摇';
      } else if (shakeRuntimeActive) {
        dom.settingShakeHint.textContent = '陀螺仪监听中，轻摇手机即可启动转盘';
      } else {
        dom.settingShakeHint.textContent = '轻摇手机即可启动转盘（需 App 9.50+）';
      }
    }

    var sensBtns = document.querySelectorAll('[data-sensitivity]');
    for (var i = 0; i < sensBtns.length; i += 1) {
      var btn = sensBtns[i];
      var isCur = btn.getAttribute('data-sensitivity') === state.shakeSensitivity;
      btn.classList.toggle('is-active', isCur);
      btn.setAttribute('aria-pressed', isCur ? 'true' : 'false');
    }

    if (window.WheelAudioMotion) {
      window.WheelAudioMotion.setSensitivity(state.shakeSensitivity);
    }

    syncShakeDockUI();
  }

  function syncShakeDockUI() {
    if (!dom.btnShakeToggle || !dom.shakeStatusDot) {
      return;
    }
    var active = shakeRuntimeActive;
    dom.btnShakeToggle.classList.toggle('is-active', active);
    dom.btnShakeToggle.setAttribute('aria-pressed', active ? 'true' : 'false');
    if (active) {
      dom.shakeStatusDot.textContent = '已开';
    } else if (state.shakeEnabled && bridgeInfo.initialized && !bridgeInfo.capabilities.gyroscope) {
      dom.shakeStatusDot.textContent = '待App';
    } else {
      dom.shakeStatusDot.textContent = '未开';
    }
    if (dom.shakeMeter) {
      dom.shakeMeter.hidden = !active;
    }
  }

  function syncExcludeDockUI(scene, excludedList) {
    var activeScene = scene || getActiveScene();
    var excluded = excludedList || getExcludedIndices(activeScene);
    var excludedCount = excluded.length;

    if (dom.btnExcludeToggle) {
      dom.btnExcludeToggle.classList.toggle('is-active', Boolean(state.excludeMode));
      dom.btnExcludeToggle.setAttribute('aria-pressed', state.excludeMode ? 'true' : 'false');
    }

    if (dom.excludeBadge) {
      if (excludedCount > 0) {
        dom.excludeBadge.hidden = false;
        dom.excludeBadge.textContent = String(excludedCount);
      } else if (state.excludeMode) {
        dom.excludeBadge.hidden = false;
        dom.excludeBadge.textContent = '开';
      } else {
        dom.excludeBadge.hidden = true;
      }
    }

    if (dom.btnRestorePool) {
      dom.btnRestorePool.hidden = excludedCount === 0;
    }
  }

  function syncHistoryBadge() {
    if (!dom.historyBadge) {
      return;
    }
    var len = state.history.length;
    if (len > 0) {
      dom.historyBadge.hidden = false;
      dom.historyBadge.textContent = String(len);
    } else {
      dom.historyBadge.hidden = true;
    }
  }

  function renderSceneStrip() {
    if (!dom.sceneStrip) {
      return;
    }
    var scenes = getAllScenes();
    var activeId = getActiveScene().id;
    var frag = document.createDocumentFragment();

    for (var i = 0; i < scenes.length; i += 1) {
      var s = scenes[i];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'scene-pill' + (s.id === activeId ? ' is-active' : '');
      btn.setAttribute('data-scene-id', s.id);
      btn.setAttribute('aria-pressed', s.id === activeId ? 'true' : 'false');
      btn.textContent = s.name;
      frag.appendChild(btn);
    }

    var addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.id = 'btn-new-custom';
    addBtn.className = 'scene-pill scene-pill-add';
    addBtn.textContent = '+ 自定义';
    frag.appendChild(addBtn);

    dom.sceneStrip.textContent = '';
    dom.sceneStrip.appendChild(frag);
    dom.btnNewCustom = addBtn;

    var activeBtn = dom.sceneStrip.querySelector('.scene-pill.is-active');
    if (activeBtn && typeof activeBtn.scrollIntoView === 'function') {
      try {
        activeBtn.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
      } catch (e) {}
    }
  }

  function triggerPointerTick() {
    if (!dom.wheelPointer) {
      return;
    }
    tickAnimAlt = !tickAnimAlt;
    dom.wheelPointer.classList.remove('is-tick-a', 'is-tick-b');
    // Force reflow only when pointer ticks so alternating keyframes always restart cleanly
    void dom.wheelPointer.offsetWidth;
    dom.wheelPointer.classList.add(tickAnimAlt ? 'is-tick-a' : 'is-tick-b');

    if (tickResetTimer !== null) {
      clearTimeout(tickResetTimer);
    }
    tickResetTimer = setTimeout(function () {
      tickResetTimer = null;
      if (dom.wheelPointer) {
        dom.wheelPointer.classList.remove('is-tick-a', 'is-tick-b');
      }
    }, 150);
  }

  function updateSpinningUI(spinning) {
    isSpinning = Boolean(spinning);
    if (window.WheelAudioMotion) {
      window.WheelAudioMotion.setSpinning(isSpinning);
    }
    if (dom.wheelStage) {
      dom.wheelStage.classList.toggle('is-spinning', isSpinning);
    }
    if (dom.btnSpinCenter) {
      dom.btnSpinCenter.disabled = isSpinning;
    }
    if (dom.btnSpinMain) {
      dom.btnSpinMain.disabled = isSpinning;
    }
    if (dom.btnSpinMainText) {
      dom.btnSpinMainText.textContent = isSpinning ? '命运转动中…' : '开始决定';
    }
    if (dom.wheelHint) {
      dom.wheelHint.textContent = isSpinning
        ? '指针正在减速落定…'
        : '拨动转盘 · 点击按钮 · 摇一摇开转';
    }
  }

  function handleWheelSpinStart() {
    if (window.WheelAudioMotion) {
      window.WheelAudioMotion.unlock();
    }
    updateSpinningUI(true);
  }

  function handleWheelIndexChange() {
    triggerPointerTick();
    var speedRatio = 0.5;
    if (wheel && typeof wheel.rotationSpeed === 'number') {
      speedRatio = Math.min(1, Math.max(0.12, Math.abs(wheel.rotationSpeed) / 560));
    }
    if (window.WheelAudioMotion && state.soundMode !== 'mute') {
      window.WheelAudioMotion.playTick(speedRatio);
    }
    if (state.vibrateEnabled && window.XhsBridge) {
      window.XhsBridge.vibrate('light');
    }
  }

  function handleWheelRest(event) {
    updateSpinningUI(false);

    var idx = event && typeof event.currentIndex === 'number'
      ? event.currentIndex
      : (wheel ? wheel.getCurrentIndex() : -1);

    if (idx < 0 || idx >= currentWheelItems.length) {
      return;
    }

    var picked = currentWheelItems[idx];
    var scene = getActiveScene();

    if (window.WheelAudioMotion && state.soundMode !== 'mute') {
      window.WheelAudioMotion.playWin();
    }
    if (state.vibrateEnabled && window.XhsBridge) {
      window.XhsBridge.vibrate('medium');
    }

    state.decisionCounter += 1;
    var fortuneNote = window.WheelPresets.generateFortuneNote(scene.id, picked.label);
    var activeCountBeforeExclude = currentWheelItems.length;

    var autoExcludedNotice = '';
    if (state.excludeMode) {
      if (activeCountBeforeExclude >= 3) {
        var existingExcluded = getExcludedIndices(scene).slice();
        if (existingExcluded.indexOf(picked.sourceIndex) === -1) {
          existingExcluded.push(picked.sourceIndex);
          state.excludedMap[scene.id] = existingExcluded;
          pendingWheelSyncAfterResult = true;
        }
        autoExcludedNotice = '不放回已排除「' + picked.label + '」，剩 ' + (activeCountBeforeExclude - 1) + ' 项';
      } else {
        autoExcludedNotice = '当前仅剩 2 项，已暂停自动排除';
      }
    }

    var candidateLabels = [];
    for (var i = 0; i < currentWheelItems.length; i += 1) {
      candidateLabels.push(currentWheelItems[i].label);
    }

    var excludedCountNow = getExcludedIndices(scene).length;
    var record = {
      id: 'dec_' + Date.now() + '_' + state.decisionCounter,
      decisionNo: state.decisionCounter,
      sceneId: scene.id,
      sceneName: scene.name,
      sceneTag: scene.tag,
      paletteId: scene.paletteId,
      accentColor: picked.backgroundColor,
      label: picked.label,
      fortuneNote: fortuneNote,
      candidates: candidateLabels,
      winnerIndex: idx,
      excludedCount: excludedCountNow,
      timestamp: Date.now()
    };

    state.history.unshift(record);
    if (state.history.length > MAX_HISTORY) {
      state.history = state.history.slice(0, MAX_HISTORY);
    }

    syncExcludeDockUI(scene);
    syncHistoryBadge();
    scheduleSaveState();

    openResultModal(record, {
      autoExcludedNotice: autoExcludedNotice,
      canExcludeRespin: activeCountBeforeExclude >= 3,
      celebrate: true,
      autoPoster: false
    });
  }

  function syncWheel(preserveRotation) {
    var scene = getActiveScene();
    var palette = window.WheelPresets.getPaletteById(scene.paletteId);
    var excluded = getExcludedIndices(scene);
    var items = window.WheelPresets.buildWheelItems(scene.items, palette.id, excluded);

    if (items.length < 2) {
      state.excludedMap[scene.id] = [];
      excluded = [];
      items = window.WheelPresets.buildWheelItems(scene.items, palette.id, []);
    }

    currentWheelItems = items;

    if (dom.headerScenePill) {
      dom.headerScenePill.textContent = scene.name;
    }
    if (dom.sceneTag) {
      dom.sceneTag.textContent = scene.tag;
    }
    if (dom.sceneTitle) {
      dom.sceneTitle.textContent = scene.name;
    }
    if (dom.sceneSubtitle) {
      dom.sceneSubtitle.textContent = scene.subtitle;
    }
    if (dom.poolCountPill) {
      if (excluded.length > 0) {
        dom.poolCountPill.textContent = '剩 ' + items.length + '/' + scene.items.length + ' 项';
      } else {
        dom.poolCountPill.textContent = items.length + ' 项可选';
      }
    }

    syncExcludeDockUI(scene, excluded);

    var wheelProps = {
      items: items,
      borderColor: palette.borderColor,
      borderWidth: 3,
      lineColor: palette.lineColor,
      lineWidth: 2,
      itemLabelColors: [palette.labelColor],
      itemLabelFont: '-apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
      itemLabelFontSizeMax: 28,
      itemLabelRadius: 0.87,
      itemLabelRadiusMax: 0.31,
      itemLabelAlign: window.SpinWheelCore.AlignText.right,
      pointerAngle: 0,
      radius: 0.98,
      rotationResistance: -175,
      rotationSpeedMax: 920,
      isInteractive: true,
      rotation: (preserveRotation && wheel) ? wheel.rotation : 0,
      onSpin: handleWheelSpinStart,
      onCurrentIndexChange: handleWheelIndexChange,
      onRest: handleWheelRest
    };

    if (!wheel && dom.wheelContainer && window.SpinWheelCore) {
      if (dom.wheelStaticFallback) {
        setElementHidden(dom.wheelStaticFallback, true);
        if (dom.wheelStaticFallback.parentNode) {
          dom.wheelStaticFallback.parentNode.removeChild(dom.wheelStaticFallback);
        }
        dom.wheelStaticFallback = null;
      }
      wheel = new window.SpinWheelCore.Wheel(dom.wheelContainer, wheelProps);
    } else if (wheel) {
      wheel.stop();
      if (isSpinning) {
        updateSpinningUI(false);
      }
      wheel.init(wheelProps);
    }
  }

  function pickWeightedIndex(items) {
    var total = 0;
    var i;
    for (i = 0; i < items.length; i += 1) {
      total += (typeof items[i].weight === 'number' && items[i].weight > 0) ? items[i].weight : 1;
    }
    if (total <= 0) {
      return 0;
    }
    var r = Math.random() * total;
    var acc = 0;
    for (i = 0; i < items.length; i += 1) {
      acc += (typeof items[i].weight === 'number' && items[i].weight > 0) ? items[i].weight : 1;
      if (r <= acc) {
        return i;
      }
    }
    return items.length - 1;
  }

  function triggerSpin(requestedSpeed) {
    if (isSpinning || !wheel || currentWheelItems.length < 2) {
      return;
    }
    if (pendingWheelSyncAfterResult) {
      pendingWheelSyncAfterResult = false;
      syncWheel(true);
    }
    if (window.WheelAudioMotion) {
      window.WheelAudioMotion.unlock();
    }

    if (prefersReducedMotion()) {
      var targetIdx = pickWeightedIndex(currentWheelItems);
      wheel.spinToItem(targetIdx, 240, false, 0, 1, window.SpinWheelCore.easing.cubicOut);
      return;
    }

    var speed = (typeof requestedSpeed === 'number' && Number.isFinite(requestedSpeed) && requestedSpeed > 0)
      ? requestedSpeed
      : (560 + Math.random() * 240);
    wheel.spin(speed);
  }

  function switchScene(sceneId) {
    if (!sceneId || state.activeSceneId === sceneId) {
      return;
    }
    if (isSpinning && wheel) {
      wheel.stop();
      updateSpinningUI(false);
    }
    pendingWheelSyncAfterResult = false;
    state.activeSceneId = sceneId;
    renderSceneStrip();
    syncWheel(false);
    scheduleSaveState();
  }

  // ---------------------------------------------------------------------------
  // 弹窗管理：原生 <dialog>.showModal() + Chrome 61 .modal-backdrop.is-open 降级
  // ---------------------------------------------------------------------------
  function getFocusableElements(container) {
    if (!container) {
      return [];
    }
    var nodes = container.querySelectorAll('button, input, [href], [tabindex]:not([tabindex="-1"])');
    var visible = [];
    for (var i = 0; i < nodes.length; i += 1) {
      var el = nodes[i];
      if (!el.disabled && el.offsetParent !== null && !el.hidden) {
        visible.push(el);
      }
    }
    return visible;
  }

  function focusModalInitial(dialogEl) {
    var focusables = getFocusableElements(dialogEl);
    var target = focusables.length > 0 ? focusables[0] : dialogEl;
    if (target && typeof target.focus === 'function') {
      try {
        target.focus();
      } catch (e) {}
    }
  }

  function openModal(dialogEl) {
    if (!dialogEl) {
      return;
    }
    if (activeModalEl && activeModalEl !== dialogEl) {
      closeModal(activeModalEl, { restoreFocus: false });
    }

    lastFocusedEl = document.activeElement || null;
    activeModalEl = dialogEl;

    var useNative = supportsDialog && typeof dialogEl.showModal === 'function';
    if (useNative) {
      try {
        dialogEl.removeAttribute('role');
        dialogEl.removeAttribute('aria-modal');
        if (!dialogEl.open) {
          dialogEl.showModal();
        }
      } catch (e) {
        useNative = false;
      }
    }

    if (!useNative) {
      if (dom.modalBackdropFallback) {
        dom.modalBackdropFallback.classList.add('is-open');
      }
      dialogEl.setAttribute('role', 'dialog');
      dialogEl.setAttribute('aria-modal', 'true');
      dialogEl.setAttribute('tabindex', '-1');
      dialogEl.classList.add('is-open');
    }

    focusModalInitial(dialogEl);
  }

  function cleanupModalState(target, shouldRestoreFocus) {
    if (!target) {
      return;
    }
    if (target === dom.modalResult) {
      stopConfetti();
      if (pendingWheelSyncAfterResult && !isSpinning) {
        pendingWheelSyncAfterResult = false;
        syncWheel(true);
      }
    }

    target.classList.remove('is-open');

    if (dom.modalBackdropFallback) {
      dom.modalBackdropFallback.classList.remove('is-open');
    }

    if (activeModalEl === target) {
      activeModalEl = null;
    }

    if (shouldRestoreFocus && lastFocusedEl && typeof lastFocusedEl.focus === 'function' && document.body.contains(lastFocusedEl)) {
      try {
        lastFocusedEl.focus();
      } catch (e) {}
    }
    if (shouldRestoreFocus) {
      lastFocusedEl = null;
    }
  }

  function closeModal(dialogEl, options) {
    var target = dialogEl || activeModalEl;
    if (!target) {
      return;
    }
    var opts = options || {};
    var shouldRestoreFocus = opts.restoreFocus !== false;

    if (activeModalEl === target) {
      activeModalEl = null;
    }

    if (target.open && typeof target.close === 'function') {
      try {
        target.close();
      } catch (e) {}
    }

    cleanupModalState(target, shouldRestoreFocus);
  }

  function isOutsidePanel(panelEl, clientX, clientY) {
    if (!panelEl) {
      return false;
    }
    var rect = panelEl.getBoundingClientRect();
    return clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom;
  }

  function setupDialogEvents(dialogEl) {
    if (!dialogEl) {
      return;
    }
    dialogEl.addEventListener('cancel', function (event) {
      event.preventDefault();
      closeModal(dialogEl);
    });

    dialogEl.addEventListener('close', function () {
      if (activeModalEl === dialogEl) {
        cleanupModalState(dialogEl, true);
      }
    });

    dialogEl.addEventListener('pointerdown', function (event) {
      var panel = dialogEl.querySelector('.dialog-panel');
      if (event.target === dialogEl || isOutsidePanel(panel, event.clientX, event.clientY)) {
        lastBackdropDownEl = dialogEl;
      } else {
        lastBackdropDownEl = null;
      }
    });

    dialogEl.addEventListener('click', function (event) {
      if (event.detail === 0 || (!dialogEl.open && !dialogEl.classList.contains('is-open'))) {
        lastBackdropDownEl = null;
        return;
      }
      var panel = dialogEl.querySelector('.dialog-panel');
      if (lastBackdropDownEl === dialogEl && (event.target === dialogEl || isOutsidePanel(panel, event.clientX, event.clientY))) {
        lastBackdropDownEl = null;
        closeModal(dialogEl);
      } else {
        lastBackdropDownEl = null;
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 轻量 Canvas 2D 彩带庆祝动效（尊重 prefers-reduced-motion）
  // ---------------------------------------------------------------------------
  function stopConfetti() {
    if (confettiRaf !== null) {
      if (typeof window.cancelAnimationFrame === 'function') {
        window.cancelAnimationFrame(confettiRaf);
      } else {
        clearTimeout(confettiRaf);
      }
      confettiRaf = null;
    }
    confettiParticles = [];
    if (dom.confettiCanvas) {
      var ctx = dom.confettiCanvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, dom.confettiCanvas.width, dom.confettiCanvas.height);
      }
    }
  }

  function startConfetti(paletteId) {
    stopConfetti();
    if (!dom.confettiCanvas || prefersReducedMotion()) {
      return;
    }
    var canvas = dom.confettiCanvas;
    var ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var width = window.innerWidth || 375;
    var height = window.innerHeight || 667;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var palette = window.WheelPresets.getPaletteById(paletteId);
    var colors = palette && Array.isArray(palette.colors) && palette.colors.length
      ? palette.colors.slice()
      : ['#F4A293', '#FAD5AE', '#B9D2BE', '#E0B96C'];
    colors.push('#E0B96C');

    var count = 44;
    for (var i = 0; i < count; i += 1) {
      var angle = (-Math.PI / 2) + (Math.random() - 0.5) * 1.45;
      var speed = 4.2 + Math.random() * 5.8;
      confettiParticles.push({
        x: width * (0.2 + Math.random() * 0.6),
        y: height * 0.28 + (Math.random() - 0.5) * 40,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5,
        w: 6 + Math.random() * 5,
        h: 4 + Math.random() * 4,
        rot: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.24,
        color: colors[i % colors.length],
        life: 0,
        maxLife: 88 + Math.random() * 36
      });
    }

    function step() {
      ctx.clearRect(0, 0, width, height);
      var alive = 0;
      for (var j = 0; j < confettiParticles.length; j += 1) {
        var p = confettiParticles[j];
        p.life += 1;
        if (p.life >= p.maxLife) {
          continue;
        }
        alive += 1;
        p.vx *= 0.985;
        p.vy += 0.19;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vRot;

        var alpha = p.life > p.maxLife * 0.65
          ? Math.max(0, 1 - (p.life - p.maxLife * 0.65) / (p.maxLife * 0.35))
          : 1;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }

      if (alive > 0 && activeModalEl === dom.modalResult && !document.hidden) {
        if (typeof window.requestAnimationFrame === 'function') {
          confettiRaf = window.requestAnimationFrame(step);
        } else {
          confettiRaf = setTimeout(step, 16);
        }
      } else {
        stopConfetti();
      }
    }

    if (typeof window.requestAnimationFrame === 'function') {
      confettiRaf = window.requestAnimationFrame(step);
    } else {
      confettiRaf = setTimeout(step, 16);
    }
  }

  // ---------------------------------------------------------------------------
  // 结果揭晓与 3:4 决定签海报弹窗
  // ---------------------------------------------------------------------------
  function generateAndShowPoster(record) {
    if (!record || !window.WheelShareCard || !dom.posterPreviewPanel || !dom.posterPreviewImg) {
      return;
    }
    var palette = window.WheelPresets.getPaletteById(record.paletteId);
    var cardCanvas = window.WheelShareCard.renderDecisionCard({
      theme: state.theme,
      sceneName: record.sceneName,
      sceneTag: record.sceneTag,
      resultLabel: record.label,
      fortuneText: record.fortuneNote,
      decisionNo: record.decisionNo,
      dateText: formatDateTime(record.timestamp),
      candidates: record.candidates,
      winnerIndex: record.winnerIndex,
      excludedCount: record.excludedCount,
      palette: palette,
      paletteId: palette.id,
      paletteColors: palette.colors,
      accentColor: record.accentColor || palette.accent
    });

    currentPosterCanvas = cardCanvas;
    try {
      dom.posterPreviewImg.src = cardCanvas.toDataURL('image/png');
    } catch (e) {}

    dom.posterPreviewPanel.hidden = false;
    if (dom.btnGeneratePosterText) {
      dom.btnGeneratePosterText.textContent = '已生成今日决定签（点击刷新）';
    }
    if (dom.posterActionStatus) {
      dom.posterActionStatus.hidden = true;
      dom.posterActionStatus.textContent = '';
    }
    if (typeof dom.posterPreviewPanel.scrollIntoView === 'function') {
      try {
        dom.posterPreviewPanel.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
      } catch (e) {}
    }
  }

  function openResultModal(record, opts) {
    if (!record || !dom.modalResult) {
      return;
    }
    var options = opts || {};
    currentResultRecord = record;
    currentPosterCanvas = null;

    if (dom.resultDecisionNo) {
      dom.resultDecisionNo.textContent = formatDecisionNo(record.decisionNo);
    }
    if (dom.resultSceneName) {
      dom.resultSceneName.textContent = record.sceneName + ' · ' + record.sceneTag;
    }
    if (dom.resultExcludedNote) {
      if (options.autoExcludedNotice) {
        dom.resultExcludedNote.hidden = false;
        dom.resultExcludedNote.textContent = options.autoExcludedNotice;
      } else {
        dom.resultExcludedNote.hidden = true;
        dom.resultExcludedNote.textContent = '';
      }
    }
    if (dom.resultColorDot) {
      dom.resultColorDot.style.backgroundColor = record.accentColor || '#D9483B';
    }
    if (dom.resultWinnerLabel) {
      dom.resultWinnerLabel.textContent = record.label;
    }
    if (dom.resultFortuneNote) {
      dom.resultFortuneNote.textContent = record.fortuneNote;
    }

    if (dom.btnResultExcludeRespin) {
      var canExclude = Boolean(options.canExcludeRespin);
      dom.btnResultExcludeRespin.disabled = !canExclude;
      dom.btnResultExcludeRespin.textContent = canExclude ? '剔除该项再转' : '仅剩2项不可剔';
    }

    if (dom.posterPreviewPanel) {
      dom.posterPreviewPanel.hidden = true;
    }
    if (dom.btnGeneratePosterText) {
      dom.btnGeneratePosterText.textContent = '生成决定签';
    }
    if (dom.posterActionStatus) {
      dom.posterActionStatus.hidden = true;
      dom.posterActionStatus.textContent = '';
    }

    openModal(dom.modalResult);

    if (options.celebrate) {
      startConfetti(record.paletteId);
    }
    if (options.autoPoster) {
      generateAndShowPoster(record);
    }
  }

  async function runPosterAction(actionName, runnerFn) {
    if (posterActionBusy || !currentResultRecord) {
      return;
    }
    if (!currentPosterCanvas) {
      generateAndShowPoster(currentResultRecord);
    }
    if (!currentPosterCanvas || !window.XhsBridge) {
      return;
    }

    posterActionBusy = true;
    if (dom.posterActionStatus) {
      dom.posterActionStatus.hidden = false;
      dom.posterActionStatus.textContent = '正在处理「' + actionName + '」…';
    }

    try {
      var res = await runnerFn(currentPosterCanvas, currentResultRecord);
      var msg = (res && res.message) ? res.message : (actionName + '完成');
      if (dom.posterActionStatus) {
        dom.posterActionStatus.hidden = false;
        dom.posterActionStatus.textContent = msg;
      }
      showToast(msg);
    } catch (e) {
      if (dom.posterActionStatus) {
        dom.posterActionStatus.hidden = false;
        dom.posterActionStatus.textContent = actionName + '遇到问题，请稍后重试';
      }
    } finally {
      posterActionBusy = false;
    }
  }

  // ---------------------------------------------------------------------------
  // 转盘编辑器弹窗
  // ---------------------------------------------------------------------------
  function renderEditorPalettes() {
    if (!dom.editorPaletteList || !editorDraft) {
      return;
    }
    var palettes = window.WheelPresets.getPalettes();
    var frag = document.createDocumentFragment();

    for (var i = 0; i < palettes.length; i += 1) {
      var pal = palettes[i];
      var selected = pal.id === editorDraft.paletteId;
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'palette-option' + (selected ? ' is-selected' : '');
      btn.setAttribute('data-palette-id', pal.id);
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', selected ? 'true' : 'false');

      var nameRow = document.createElement('div');
      nameRow.className = 'palette-name-row';
      var nameSpan = document.createElement('span');
      nameSpan.textContent = pal.name;
      nameRow.appendChild(nameSpan);
      if (selected) {
        var checkSpan = document.createElement('span');
        checkSpan.className = 'palette-check';
        checkSpan.textContent = '✓';
        nameRow.appendChild(checkSpan);
      }
      btn.appendChild(nameRow);

      var swatches = document.createElement('div');
      swatches.className = 'palette-swatches';
      for (var c = 0; c < pal.colors.length; c += 1) {
        var dot = document.createElement('span');
        dot.className = 'palette-swatch';
        dot.style.backgroundColor = pal.colors[c];
        swatches.appendChild(dot);
      }
      btn.appendChild(swatches);
      frag.appendChild(btn);
    }

    dom.editorPaletteList.textContent = '';
    dom.editorPaletteList.appendChild(frag);
  }

  function renderEditorItems() {
    if (!dom.editorItemsList || !editorDraft) {
      return;
    }
    var palette = window.WheelPresets.getPaletteById(editorDraft.paletteId);
    var colors = palette.colors;
    var items = editorDraft.items;
    var minItems = window.WheelPresets.MIN_ITEMS;
    var maxItems = window.WheelPresets.MAX_ITEMS;
    var minWeight = window.WheelPresets.MIN_WEIGHT;
    var maxWeight = window.WheelPresets.MAX_WEIGHT;

    if (dom.editorItemsCount) {
      dom.editorItemsCount.textContent = '选项列表 (' + items.length + '/' + maxItems + ')';
    }
    if (dom.btnEditorAddItem) {
      dom.btnEditorAddItem.disabled = items.length >= maxItems;
    }

    var frag = document.createDocumentFragment();
    for (var i = 0; i < items.length; i += 1) {
      var item = items[i];
      var row = document.createElement('div');
      row.className = 'editor-item-row';
      row.setAttribute('data-item-index', String(i));

      var dot = document.createElement('span');
      dot.className = 'editor-item-color';
      dot.style.backgroundColor = colors[i % colors.length];
      row.appendChild(dot);

      var input = document.createElement('input');
      input.type = 'text';
      input.className = 'editor-item-input';
      input.maxLength = window.WheelPresets.MAX_LABEL_LENGTH;
      input.value = item.label;
      input.placeholder = '选项 ' + (i + 1);
      input.setAttribute('aria-label', '第 ' + (i + 1) + ' 个选项名称');
      input.setAttribute('data-role', 'item-label');
      input.setAttribute('data-item-index', String(i));
      row.appendChild(input);

      var stepper = document.createElement('div');
      stepper.className = 'weight-stepper';

      var decBtn = document.createElement('button');
      decBtn.type = 'button';
      decBtn.className = 'weight-btn';
      decBtn.textContent = '-';
      decBtn.disabled = item.weight <= minWeight;
      decBtn.setAttribute('aria-label', '降低第 ' + (i + 1) + ' 项权重');
      decBtn.setAttribute('data-role', 'weight-dec');
      decBtn.setAttribute('data-item-index', String(i));
      stepper.appendChild(decBtn);

      var valSpan = document.createElement('span');
      valSpan.className = 'weight-val';
      valSpan.textContent = item.weight + 'x';
      stepper.appendChild(valSpan);

      var incBtn = document.createElement('button');
      incBtn.type = 'button';
      incBtn.className = 'weight-btn';
      incBtn.textContent = '+';
      incBtn.disabled = item.weight >= maxWeight;
      incBtn.setAttribute('aria-label', '增加第 ' + (i + 1) + ' 项权重');
      incBtn.setAttribute('data-role', 'weight-inc');
      incBtn.setAttribute('data-item-index', String(i));
      stepper.appendChild(incBtn);

      row.appendChild(stepper);

      var rmBtn = document.createElement('button');
      rmBtn.type = 'button';
      rmBtn.className = 'editor-item-remove';
      rmBtn.textContent = '×';
      rmBtn.disabled = items.length <= minItems;
      rmBtn.setAttribute('aria-label', '删除第 ' + (i + 1) + ' 项');
      rmBtn.setAttribute('data-role', 'item-remove');
      rmBtn.setAttribute('data-item-index', String(i));
      row.appendChild(rmBtn);

      frag.appendChild(row);
    }

    dom.editorItemsList.textContent = '';
    dom.editorItemsList.appendChild(frag);
  }

  function refreshEditorUI() {
    if (!editorDraft) {
      return;
    }
    if (dom.editorModalTitle) {
      dom.editorModalTitle.textContent = editorDraft.mode === 'create' ? '新建自定义转盘' : '编辑转盘选项';
    }
    if (dom.editorSceneName) {
      dom.editorSceneName.value = editorDraft.name;
    }
    if (dom.btnEditorResetPreset) {
      dom.btnEditorResetPreset.hidden = editorDraft.mode === 'create' || editorDraft.isCustom;
    }
    if (dom.btnEditorDeleteCustom) {
      dom.btnEditorDeleteCustom.hidden = !(editorDraft.mode === 'edit' && editorDraft.isCustom);
    }
    if (dom.editorError) {
      dom.editorError.hidden = true;
      dom.editorError.textContent = '';
    }
    renderEditorPalettes();
    renderEditorItems();
  }

  function openEditorModal(mode) {
    if (!dom.modalEditor) {
      return;
    }
    if (mode === 'create') {
      var created = window.WheelPresets.createCustomScene({
        paletteId: getActiveScene().paletteId
      });
      editorDraft = Object.assign({ mode: 'create' }, created);
    } else {
      var active = getActiveScene();
      editorDraft = Object.assign({ mode: 'edit' }, window.WheelPresets.cloneScene(active));
    }
    refreshEditorUI();
    openModal(dom.modalEditor);
  }

  function saveEditorDraft() {
    if (!editorDraft) {
      return;
    }
    if (dom.editorSceneName) {
      editorDraft.name = dom.editorSceneName.value;
    }
    var check = window.WheelPresets.validateScene(editorDraft);
    if (!check.valid) {
      if (dom.editorError) {
        dom.editorError.hidden = false;
        dom.editorError.textContent = check.errors[0] || '请检查标题与选项是否填写完整';
      }
      return;
    }

    var savedScene = check.scene;
    if (editorDraft.mode === 'create') {
      savedScene.isCustom = true;
      state.customScenes.push(savedScene);
      state.activeSceneId = savedScene.id;
    } else if (savedScene.isCustom) {
      var replaced = false;
      for (var i = 0; i < state.customScenes.length; i += 1) {
        if (state.customScenes[i].id === savedScene.id) {
          state.customScenes[i] = savedScene;
          replaced = true;
          break;
        }
      }
      if (!replaced) {
        state.customScenes.push(savedScene);
      }
      state.activeSceneId = savedScene.id;
    } else {
      savedScene.isCustom = false;
      state.presetOverrides[savedScene.id] = savedScene;
      state.activeSceneId = savedScene.id;
    }

    state.excludedMap[savedScene.id] = [];
    pendingWheelSyncAfterResult = false;
    persistStateNow();

    closeModal(dom.modalEditor);
    renderSceneStrip();
    syncWheel(false);
    showToast(editorDraft.mode === 'create' ? '已创建并切换到新转盘' : '已保存转盘设置');
  }

  // ---------------------------------------------------------------------------
  // 历史记录弹窗
  // ---------------------------------------------------------------------------
  function renderHistoryList() {
    if (!dom.historyList || !dom.historyEmpty) {
      return;
    }
    var list = state.history;
    if (!list || list.length === 0) {
      dom.historyEmpty.hidden = false;
      dom.historyList.hidden = true;
      dom.historyList.textContent = '';
      if (dom.btnHistoryClear) {
        dom.btnHistoryClear.disabled = true;
      }
      return;
    }

    if (dom.btnHistoryClear) {
      dom.btnHistoryClear.disabled = false;
    }
    dom.historyEmpty.hidden = true;
    dom.historyList.hidden = false;

    var frag = document.createDocumentFragment();
    for (var i = 0; i < list.length; i += 1) {
      var item = list[i];
      var li = document.createElement('li');
      li.className = 'history-item';

      var main = document.createElement('div');
      main.className = 'history-item-main';

      var top = document.createElement('div');
      top.className = 'history-item-top';

      var noSpan = document.createElement('span');
      noSpan.className = 'history-no';
      noSpan.textContent = formatDecisionNo(item.decisionNo);
      top.appendChild(noSpan);

      var sceneSpan = document.createElement('span');
      sceneSpan.className = 'history-scene';
      sceneSpan.textContent = (item.sceneName || '决定大转盘') + (item.sceneTag ? ' · ' + item.sceneTag : '');
      top.appendChild(sceneSpan);

      main.appendChild(top);

      var labelEl = document.createElement('p');
      labelEl.className = 'history-label';
      labelEl.textContent = item.label;
      main.appendChild(labelEl);

      var timeEl = document.createElement('p');
      timeEl.className = 'history-time';
      timeEl.textContent = formatShortDate(item.timestamp);
      main.appendChild(timeEl);

      li.appendChild(main);

      var posterBtn = document.createElement('button');
      posterBtn.type = 'button';
      posterBtn.className = 'history-poster-btn';
      posterBtn.textContent = '决定签';
      posterBtn.setAttribute('data-history-index', String(i));
      li.appendChild(posterBtn);

      frag.appendChild(li);
    }

    dom.historyList.textContent = '';
    dom.historyList.appendChild(frag);
  }

  function openHistoryModal() {
    renderHistoryList();
    openModal(dom.modalHistory);
  }

  // ---------------------------------------------------------------------------
  // 陀螺仪摇一摇控制与生命周期恢复
  // ---------------------------------------------------------------------------
  function handleGyroSample(sample) {
    if (!window.WheelAudioMotion || document.hidden) {
      return;
    }
    window.WheelAudioMotion.feedGyro(sample, isSpinning);
  }

  async function startShakeIfNeeded(opts) {
    var options = opts || {};
    if (!state.shakeEnabled || document.hidden || !window.XhsBridge) {
      return false;
    }
    if (shakeRuntimeActive) {
      return true;
    }
    var res = await window.XhsBridge.startGyroscope(handleGyroSample, 'ui');
    if (res && res.ok) {
      if (document.hidden || !state.shakeEnabled) {
        shakeRuntimeActive = true;
        await stopShakeRuntime();
        return false;
      }
      shakeRuntimeActive = true;
      syncSettingsUI();
      if (!options.silent) {
        showToast('摇一摇开转已开启，轻摇手机即可开转');
      }
      return true;
    }
    shakeRuntimeActive = false;
    syncSettingsUI();
    if (!options.silent && res && res.message) {
      showToast(res.message);
    }
    return false;
  }

  async function stopShakeRuntime() {
    if (gyroStopping) {
      return;
    }
    gyroStopping = true;
    try {
      if (window.XhsBridge && typeof window.XhsBridge.stopGyroscope === 'function') {
        await window.XhsBridge.stopGyroscope(handleGyroSample);
      }
    } catch (e) {}
    gyroStopping = false;
    shakeRuntimeActive = false;
    if (window.WheelAudioMotion) {
      window.WheelAudioMotion.resetGyro();
    }
    if (dom.shakeMeterFill) {
      dom.shakeMeterFill.style.transform = 'scaleX(0)';
    }
    syncSettingsUI();
  }

  // ---------------------------------------------------------------------------
  // 事件绑定
  // ---------------------------------------------------------------------------
  function bindEvents() {
    window.addEventListener('resize', updateAppHeight);
    if (window.visualViewport && typeof window.visualViewport.addEventListener === 'function') {
      window.visualViewport.addEventListener('resize', updateAppHeight);
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        stopConfetti();
        persistStateNow();
        if (shakeRuntimeActive) {
          stopShakeRuntime();
        }
      } else {
        updateAppHeight();
        if (window.XhsBridge && typeof window.XhsBridge.applyWindowLayout === 'function') {
          window.XhsBridge.applyWindowLayout();
        }
        if (wheel) {
          wheel.resize();
        }
        if (state.shakeEnabled) {
          startShakeIfNeeded({ silent: true });
        }
      }
    });

    document.addEventListener('keydown', function (event) {
      if (!activeModalEl) {
        return;
      }
      if (event.key === 'Escape' || event.keyCode === 27) {
        if (!supportsDialog || !activeModalEl.open) {
          event.preventDefault();
          closeModal(activeModalEl);
        }
        return;
      }
      if (event.key === 'Tab' && !activeModalEl.open) {
        var focusables = getFocusableElements(activeModalEl);
        if (focusables.length === 0) {
          event.preventDefault();
          return;
        }
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });

    if (dom.modalBackdropFallback) {
      dom.modalBackdropFallback.addEventListener('pointerdown', function () {
        lastBackdropDownEl = dom.modalBackdropFallback;
      });
      dom.modalBackdropFallback.addEventListener('click', function (event) {
        if (event.detail !== 0 && lastBackdropDownEl === dom.modalBackdropFallback && activeModalEl) {
          lastBackdropDownEl = null;
          closeModal(activeModalEl);
        } else {
          lastBackdropDownEl = null;
        }
      });
    }

    setupDialogEvents(dom.modalResult);
    setupDialogEvents(dom.modalEditor);
    setupDialogEvents(dom.modalHistory);
    setupDialogEvents(dom.modalSettings);

    // 顶部栏按钮
    if (dom.btnTheme) {
      dom.btnTheme.addEventListener('click', function () {
        var next = state.theme === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        scheduleSaveState();
      });
    }

    if (dom.btnSound) {
      dom.btnSound.addEventListener('click', function () {
        if (window.WheelAudioMotion) {
          window.WheelAudioMotion.unlock();
        }
        if (state.soundMode === 'mute') {
          state.soundMode = state.lastActiveSoundMode || 'ratchet';
        } else {
          state.lastActiveSoundMode = state.soundMode;
          state.soundMode = 'mute';
        }
        syncAudioUI();
        if (state.soundMode !== 'mute' && window.WheelAudioMotion) {
          window.WheelAudioMotion.playTick(0.6);
        }
        scheduleSaveState();
      });
    }

    if (dom.btnSettings) {
      dom.btnSettings.addEventListener('click', function () {
        syncSettingsUI();
        openModal(dom.modalSettings);
      });
    }

    // 横向场景胶囊条（事件委托）
    if (dom.sceneStrip) {
      dom.sceneStrip.addEventListener('click', function (event) {
        var target = event.target;
        while (target && target !== dom.sceneStrip && target.tagName !== 'BUTTON') {
          target = target.parentNode;
        }
        if (!target || target.tagName !== 'BUTTON') {
          return;
        }
        if (target.id === 'btn-new-custom') {
          openEditorModal('create');
          return;
        }
        var sceneId = target.getAttribute('data-scene-id');
        if (sceneId) {
          switchScene(sceneId);
        }
      });
    }

    // 复原排除项按钮
    if (dom.btnRestorePool) {
      dom.btnRestorePool.addEventListener('click', function () {
        var scene = getActiveScene();
        state.excludedMap[scene.id] = [];
        pendingWheelSyncAfterResult = false;
        syncWheel(true);
        scheduleSaveState();
        showToast('已复原当前场景全部选项');
      });
    }

    // 转盘旋转触发
    if (dom.btnSpinCenter) {
      dom.btnSpinCenter.addEventListener('click', function () {
        triggerSpin();
      });
    }
    if (dom.btnSpinMain) {
      dom.btnSpinMain.addEventListener('click', function () {
        triggerSpin();
      });
    }
    if (dom.wheelContainer) {
      var checkWheelReleaseIdle = function () {
        setTimeout(function () {
          if (isSpinning && wheel && !wheel.isDragging && wheel.rotationSpeed === 0 && wheel._spinToTimeEnd === null) {
            updateSpinningUI(false);
          }
        }, 60);
      };
      dom.wheelContainer.addEventListener('pointerdown', function () {
        if (window.WheelAudioMotion) {
          window.WheelAudioMotion.unlock();
        }
      });
      dom.wheelContainer.addEventListener('pointerup', checkWheelReleaseIdle);
      dom.wheelContainer.addEventListener('pointercancel', checkWheelReleaseIdle);
      dom.wheelContainer.addEventListener('touchend', checkWheelReleaseIdle);
    }

    // 底部快捷栏
    if (dom.btnExcludeToggle) {
      dom.btnExcludeToggle.addEventListener('click', function () {
        state.excludeMode = !state.excludeMode;
        var scene = getActiveScene();
        if (!state.excludeMode && getExcludedIndices(scene).length > 0) {
          syncExcludeDockUI(scene);
          showToast('已关闭不放回模式（已排除项仍可点「一键复原」）');
        } else if (state.excludeMode) {
          syncExcludeDockUI(scene);
          showToast('已开启不放回模式：抽中项将自动排除');
        } else {
          syncExcludeDockUI(scene);
          showToast('已恢复普通抽选模式');
        }
        scheduleSaveState();
      });
    }

    if (dom.btnEditWheel) {
      dom.btnEditWheel.addEventListener('click', function () {
        openEditorModal('edit');
      });
    }

    if (dom.btnShakeToggle) {
      dom.btnShakeToggle.addEventListener('click', function () {
        if (window.WheelAudioMotion) {
          window.WheelAudioMotion.unlock();
        }
        if (shakeRuntimeActive) {
          state.shakeEnabled = false;
          stopShakeRuntime();
          scheduleSaveState();
          showToast('已关闭摇一摇开转');
        } else {
          state.shakeEnabled = true;
          scheduleSaveState();
          startShakeIfNeeded({ silent: false });
        }
      });
    }

    if (dom.btnHistory) {
      dom.btnHistory.addEventListener('click', openHistoryModal);
    }

    // 结果弹窗按钮
    if (dom.btnCloseResult) {
      dom.btnCloseResult.addEventListener('click', function () {
        closeModal(dom.modalResult);
      });
    }

    if (dom.btnResultRespin) {
      dom.btnResultRespin.addEventListener('click', function () {
        closeModal(dom.modalResult, { restoreFocus: false });
        triggerSpin();
      });
    }

    if (dom.btnResultExcludeRespin) {
      dom.btnResultExcludeRespin.addEventListener('click', function () {
        if (!currentResultRecord) {
          return;
        }
        var scene = getActiveScene();
        if (currentWheelItems.length < 3) {
          showToast('至少需要保留 2 个选项，无法继续剔除');
          return;
        }
        var targetSourceIdx = -1;
        for (var i = 0; i < currentWheelItems.length; i += 1) {
          if (currentWheelItems[i].label === currentResultRecord.label && i === currentResultRecord.winnerIndex) {
            targetSourceIdx = currentWheelItems[i].sourceIndex;
            break;
          }
        }
        if (targetSourceIdx === -1) {
          for (var j = 0; j < currentWheelItems.length; j += 1) {
            if (currentWheelItems[j].label === currentResultRecord.label) {
              targetSourceIdx = currentWheelItems[j].sourceIndex;
              break;
            }
          }
        }
        if (targetSourceIdx !== -1) {
          var list = getExcludedIndices(scene).slice();
          if (list.indexOf(targetSourceIdx) === -1) {
            list.push(targetSourceIdx);
            state.excludedMap[scene.id] = list;
          }
        }
        pendingWheelSyncAfterResult = false;
        syncWheel(true);
        scheduleSaveState();
        closeModal(dom.modalResult, { restoreFocus: false });
        triggerSpin();
      });
    }

    if (dom.btnGeneratePoster) {
      dom.btnGeneratePoster.addEventListener('click', function () {
        generateAndShowPoster(currentResultRecord);
      });
    }

    if (dom.btnPosterSave) {
      dom.btnPosterSave.addEventListener('click', function () {
        runPosterAction('保存相册', function (canvas) {
          return window.XhsBridge.saveCanvasToAlbum(canvas);
        });
      });
    }

    if (dom.btnPosterPost) {
      dom.btnPosterPost.addEventListener('click', function () {
        runPosterAction('发笔记', function (canvas, rec) {
          var title = '决定大转盘｜' + rec.label;
          var content = '「' + rec.sceneName + '」帮我选中了【' + rec.label + '】！' +
            rec.fortuneNote + '\n\n纠结星人必备决定大转盘，一起来转出今日好运～';
          return window.XhsBridge.postNoteWithCanvas(canvas, title, content);
        });
      });
    }

    if (dom.btnPosterComment) {
      dom.btnPosterComment.addEventListener('click', function () {
        runPosterAction('评论区晒结果', function (canvas, rec) {
          var text = '「' + rec.sceneName + '」天选结果：' + rec.label + '！你也来转一下～';
          var snapshot = {
            sceneId: rec.sceneId,
            sceneName: rec.sceneName,
            label: rec.label,
            decisionNo: rec.decisionNo
          };
          return window.XhsBridge.commentWithCanvas(canvas, text, snapshot);
        });
      });
    }

    if (dom.btnPosterShare) {
      dom.btnPosterShare.addEventListener('click', function () {
        runPosterAction('分享工具卡', function (canvas, rec) {
          return window.XhsBridge.shareToolCard(
            '决定大转盘',
            '「' + rec.sceneName + '」帮我选中了 ' + rec.label
          );
        });
      });
    }

    // 编辑器弹窗事件
    if (dom.btnCloseEditor) {
      dom.btnCloseEditor.addEventListener('click', function () {
        closeModal(dom.modalEditor);
      });
    }
    if (dom.btnEditorCancel) {
      dom.btnEditorCancel.addEventListener('click', function () {
        closeModal(dom.modalEditor);
      });
    }
    if (dom.btnEditorSave) {
      dom.btnEditorSave.addEventListener('click', saveEditorDraft);
    }

    if (dom.btnEditorNewCustom) {
      dom.btnEditorNewCustom.addEventListener('click', function () {
        var created = window.WheelPresets.createCustomScene({
          paletteId: editorDraft ? editorDraft.paletteId : getActiveScene().paletteId
        });
        editorDraft = Object.assign({ mode: 'create' }, created);
        refreshEditorUI();
      });
    }

    if (dom.btnEditorResetPreset) {
      dom.btnEditorResetPreset.addEventListener('click', function () {
        if (!editorDraft || editorDraft.isCustom) {
          return;
        }
        var fresh = window.WheelPresets.getPresetById(editorDraft.id);
        if (fresh) {
          editorDraft = Object.assign({ mode: 'edit' }, fresh);
          refreshEditorUI();
          showToast('已还原预设内容，点击「保存并应用」生效');
        }
      });
    }

    if (dom.btnEditorDeleteCustom) {
      dom.btnEditorDeleteCustom.addEventListener('click', function () {
        if (!editorDraft || !editorDraft.isCustom || editorDraft.mode !== 'edit') {
          return;
        }
        var removeId = editorDraft.id;
        state.customScenes = state.customScenes.filter(function (s) {
          return s.id !== removeId;
        });
        delete state.excludedMap[removeId];
        if (state.activeSceneId === removeId) {
          state.activeSceneId = window.WheelPresets.DEFAULT_PRESET_ID;
        }
        persistStateNow();
        closeModal(dom.modalEditor);
        renderSceneStrip();
        syncWheel(false);
        showToast('已删除自定义转盘');
      });
    }

    if (dom.editorSceneName) {
      dom.editorSceneName.addEventListener('input', function () {
        if (editorDraft) {
          editorDraft.name = dom.editorSceneName.value;
        }
      });
    }

    if (dom.editorPaletteList) {
      dom.editorPaletteList.addEventListener('click', function (event) {
        var target = event.target;
        while (target && target !== dom.editorPaletteList && !target.getAttribute('data-palette-id')) {
          target = target.parentNode;
        }
        if (!target || target === dom.editorPaletteList) {
          return;
        }
        var palId = target.getAttribute('data-palette-id');
        if (palId && editorDraft) {
          editorDraft.paletteId = palId;
          renderEditorPalettes();
          renderEditorItems();
        }
      });
    }

    if (dom.btnEditorAddItem) {
      dom.btnEditorAddItem.addEventListener('click', function () {
        if (!editorDraft || editorDraft.items.length >= window.WheelPresets.MAX_ITEMS) {
          return;
        }
        editorDraft.items.push({
          label: '新选项 ' + (editorDraft.items.length + 1),
          weight: 1
        });
        renderEditorItems();
        var inputs = dom.editorItemsList.querySelectorAll('.editor-item-input');
        if (inputs.length > 0) {
          var lastInput = inputs[inputs.length - 1];
          lastInput.focus();
          if (typeof lastInput.select === 'function') {
            lastInput.select();
          }
        }
      });
    }

    if (dom.editorItemsList) {
      dom.editorItemsList.addEventListener('input', function (event) {
        var target = event.target;
        if (!editorDraft || !target || target.getAttribute('data-role') !== 'item-label') {
          return;
        }
        var idx = Number(target.getAttribute('data-item-index'));
        if (Number.isFinite(idx) && editorDraft.items[idx]) {
          editorDraft.items[idx].label = target.value;
        }
      });

      dom.editorItemsList.addEventListener('click', function (event) {
        if (!editorDraft) {
          return;
        }
        var target = event.target;
        while (target && target !== dom.editorItemsList && !target.getAttribute('data-role')) {
          target = target.parentNode;
        }
        if (!target || target === dom.editorItemsList) {
          return;
        }
        var role = target.getAttribute('data-role');
        var idx = Number(target.getAttribute('data-item-index'));
        if (!Number.isFinite(idx) || !editorDraft.items[idx]) {
          return;
        }
        if (role === 'weight-dec') {
          editorDraft.items[idx].weight = Math.max(window.WheelPresets.MIN_WEIGHT, editorDraft.items[idx].weight - 1);
          renderEditorItems();
        } else if (role === 'weight-inc') {
          editorDraft.items[idx].weight = Math.min(window.WheelPresets.MAX_WEIGHT, editorDraft.items[idx].weight + 1);
          renderEditorItems();
        } else if (role === 'item-remove') {
          if (editorDraft.items.length <= window.WheelPresets.MIN_ITEMS) {
            showToast('至少保留 ' + window.WheelPresets.MIN_ITEMS + ' 个选项');
            return;
          }
          editorDraft.items.splice(idx, 1);
          renderEditorItems();
        }
      });
    }

    // 历史记录弹窗事件
    if (dom.btnCloseHistory) {
      dom.btnCloseHistory.addEventListener('click', function () {
        closeModal(dom.modalHistory);
      });
    }

    if (dom.btnHistoryClear) {
      dom.btnHistoryClear.addEventListener('click', function () {
        state.history = [];
        renderHistoryList();
        syncHistoryBadge();
        scheduleSaveState();
        showToast('已清空决定历史');
      });
    }

    if (dom.historyList) {
      dom.historyList.addEventListener('click', function (event) {
        var target = event.target;
        while (target && target !== dom.historyList && !target.getAttribute('data-history-index')) {
          target = target.parentNode;
        }
        if (!target || target === dom.historyList) {
          return;
        }
        var idx = Number(target.getAttribute('data-history-index'));
        if (!Number.isFinite(idx) || !state.history[idx]) {
          return;
        }
        var rec = state.history[idx];
        closeModal(dom.modalHistory, { restoreFocus: false });
        openResultModal(rec, {
          autoExcludedNotice: '',
          canExcludeRespin: false,
          celebrate: false,
          autoPoster: true
        });
      });
    }

    // 设置与关于弹窗事件
    if (dom.btnCloseSettings) {
      dom.btnCloseSettings.addEventListener('click', function () {
        closeModal(dom.modalSettings);
      });
    }

    if (dom.btnSettingThemeLight) {
      dom.btnSettingThemeLight.addEventListener('click', function () {
        applyTheme('light');
        scheduleSaveState();
      });
    }

    if (dom.btnSettingThemeDark) {
      dom.btnSettingThemeDark.addEventListener('click', function () {
        applyTheme('dark');
        scheduleSaveState();
      });
    }

    if (dom.modalSettings) {
      dom.modalSettings.addEventListener('click', function (event) {
        var target = event.target;
        while (target && target !== dom.modalSettings && target.tagName !== 'BUTTON') {
          target = target.parentNode;
        }
        if (!target || target.tagName !== 'BUTTON') {
          return;
        }
        var soundModeAttr = target.getAttribute('data-sound-mode');
        if (soundModeAttr) {
          if (window.WheelAudioMotion) {
            window.WheelAudioMotion.unlock();
          }
          state.soundMode = soundModeAttr;
          if (soundModeAttr !== 'mute') {
            state.lastActiveSoundMode = soundModeAttr;
          }
          syncAudioUI();
          if (soundModeAttr !== 'mute' && window.WheelAudioMotion) {
            window.WheelAudioMotion.playTick(0.65);
          }
          scheduleSaveState();
          return;
        }

        var sensAttr = target.getAttribute('data-sensitivity');
        if (sensAttr) {
          state.shakeSensitivity = sensAttr;
          syncSettingsUI();
          scheduleSaveState();
        }
      });
    }

    if (dom.btnSettingVibrate) {
      dom.btnSettingVibrate.addEventListener('click', function () {
        state.vibrateEnabled = !state.vibrateEnabled;
        syncSettingsUI();
        if (state.vibrateEnabled && window.XhsBridge) {
          window.XhsBridge.vibrate('light');
        }
        scheduleSaveState();
      });
    }

    if (dom.btnSettingShake) {
      dom.btnSettingShake.addEventListener('click', function () {
        state.shakeEnabled = !state.shakeEnabled;
        syncSettingsUI();
        scheduleSaveState();
        if (state.shakeEnabled) {
          startShakeIfNeeded({ silent: false });
        } else {
          stopShakeRuntime();
        }
      });
    }
  }

  function cacheDom() {
    dom.metaColorScheme = byId('meta-color-scheme');
    dom.btnTheme = byId('btn-theme');
    dom.iconThemeSun = dom.btnTheme ? dom.btnTheme.querySelector('.icon-theme-sun') : null;
    dom.iconThemeMoon = dom.btnTheme ? dom.btnTheme.querySelector('.icon-theme-moon') : null;
    dom.btnSound = byId('btn-sound');
    dom.iconSoundOn = dom.btnSound ? dom.btnSound.querySelector('.icon-sound-on') : null;
    dom.iconSoundOff = dom.btnSound ? dom.btnSound.querySelector('.icon-sound-off') : null;
    dom.btnSettings = byId('btn-settings');
    dom.headerScenePill = byId('header-scene-pill');

    dom.sceneStrip = byId('scene-strip');
    dom.btnNewCustom = byId('btn-new-custom');
    dom.sceneTag = byId('scene-tag');
    dom.sceneTitle = byId('scene-title');
    dom.sceneSubtitle = byId('scene-subtitle');
    dom.poolCountPill = byId('pool-count-pill');
    dom.btnRestorePool = byId('btn-restore-pool');

    dom.wheelStage = document.querySelector('.wheel-stage');
    dom.wheelPointer = byId('wheel-pointer');
    dom.wheelContainer = byId('wheel-container');
    dom.wheelStaticFallback = byId('wheel-static-fallback');
    dom.btnSpinCenter = byId('btn-spin-center');
    dom.btnSpinMain = byId('btn-spin-main');
    dom.btnSpinMainText = byId('btn-spin-main-text');
    dom.wheelHint = byId('wheel-hint');
    dom.shakeMeter = byId('shake-meter');
    dom.shakeMeterFill = byId('shake-meter-fill');

    dom.btnExcludeToggle = byId('btn-exclude-toggle');
    dom.excludeBadge = byId('exclude-badge');
    dom.btnEditWheel = byId('btn-edit-wheel');
    dom.btnShakeToggle = byId('btn-shake-toggle');
    dom.shakeStatusDot = byId('shake-status-dot');
    dom.btnHistory = byId('btn-history');
    dom.historyBadge = byId('history-badge');

    dom.toast = byId('app-toast');
    dom.modalBackdropFallback = byId('modal-backdrop-fallback');

    dom.modalResult = byId('modal-result');
    dom.confettiCanvas = byId('confetti-canvas');
    dom.btnCloseResult = byId('btn-close-result');
    dom.resultDecisionNo = byId('result-decision-no');
    dom.resultSceneName = byId('result-scene-name');
    dom.resultExcludedNote = byId('result-excluded-note');
    dom.resultColorDot = byId('result-color-dot');
    dom.resultWinnerLabel = byId('result-winner-label');
    dom.resultFortuneNote = byId('result-fortune-note');
    dom.btnResultRespin = byId('btn-result-respin');
    dom.btnResultExcludeRespin = byId('btn-result-exclude-respin');
    dom.btnGeneratePoster = byId('btn-generate-poster');
    dom.btnGeneratePosterText = byId('btn-generate-poster-text');
    dom.posterPreviewPanel = byId('poster-preview-panel');
    dom.posterPreviewImg = byId('poster-preview-img');
    dom.btnPosterSave = byId('btn-poster-save');
    dom.btnPosterPost = byId('btn-poster-post');
    dom.btnPosterComment = byId('btn-poster-comment');
    dom.btnPosterShare = byId('btn-poster-share');
    dom.posterActionStatus = byId('poster-action-status');

    dom.modalEditor = byId('modal-editor');
    dom.editorModalTitle = byId('editor-modal-title');
    dom.btnCloseEditor = byId('btn-close-editor');
    dom.btnEditorNewCustom = byId('btn-editor-new-custom');
    dom.btnEditorResetPreset = byId('btn-editor-reset-preset');
    dom.btnEditorDeleteCustom = byId('btn-editor-delete-custom');
    dom.editorSceneName = byId('editor-scene-name');
    dom.editorPaletteList = byId('editor-palette-list');
    dom.editorItemsCount = byId('editor-items-count');
    dom.btnEditorAddItem = byId('btn-editor-add-item');
    dom.editorItemsList = byId('editor-items-list');
    dom.editorError = byId('editor-error');
    dom.btnEditorCancel = byId('btn-editor-cancel');
    dom.btnEditorSave = byId('btn-editor-save');

    dom.modalHistory = byId('modal-history');
    dom.btnHistoryClear = byId('btn-history-clear');
    dom.btnCloseHistory = byId('btn-close-history');
    dom.historyEmpty = byId('history-empty');
    dom.historyList = byId('history-list');

    dom.modalSettings = byId('modal-settings');
    dom.btnCloseSettings = byId('btn-close-settings');
    dom.btnSettingThemeLight = byId('btn-setting-theme-light');
    dom.btnSettingThemeDark = byId('btn-setting-theme-dark');
    dom.btnSettingVibrate = byId('btn-setting-vibrate');
    dom.settingVibrateHint = byId('setting-vibrate-hint');
    dom.btnSettingShake = byId('btn-setting-shake');
    dom.settingShakeHint = byId('setting-shake-hint');
  }

  async function boot() {
    if (supportsFlexGap()) {
      document.documentElement.classList.add('supports-flex-gap');
    }
    updateAppHeight();
    initMediaQueries();
    cacheDom();

    supportsDialog = (
      typeof window.HTMLDialogElement === 'function' &&
      dom.modalResult &&
      typeof dom.modalResult.showModal === 'function'
    );

    // 首帧先挂载默认主题与默认转盘，避免白屏等待持久化
    applyTheme(state.theme);
    syncAudioUI();
    syncHistoryBadge();
    renderSceneStrip();
    syncWheel(false);
    bindEvents();

    if (window.WheelAudioMotion) {
      window.WheelAudioMotion.setOnShake(function (info) {
        if (activeModalEl || isSpinning || document.hidden) {
          return;
        }
        window.WheelAudioMotion.unlock();
        if (state.vibrateEnabled && window.XhsBridge) {
          window.XhsBridge.vibrate('medium');
        }
        triggerSpin(info && info.suggestedSpeed ? info.suggestedSpeed : 660);
      });

      window.WheelAudioMotion.setOnMotion(function (strength) {
        if (dom.shakeMeterFill) {
          var clamped = Math.max(0, Math.min(1, Number(strength) || 0));
          dom.shakeMeterFill.style.transform = 'scaleX(' + clamped.toFixed(3) + ')';
        }
      });
    }

    if (window.XhsBridge) {
      try {
        await window.XhsBridge.applyWindowLayout();
        bridgeInfo = await window.XhsBridge.init();
      } catch (e) {}

      try {
        var loaded = await window.XhsBridge.loadState(STORAGE_KEY);
        if (loaded && loaded.ok && loaded.data) {
          sanitizeSavedState(loaded.data);
          applyTheme(state.theme);
          syncAudioUI();
          syncHistoryBadge();
          renderSceneStrip();
          syncWheel(false);
        }
      } catch (err) {}

      syncSettingsUI();

      if (state.shakeEnabled && !document.hidden) {
        startShakeIfNeeded({ silent: true });
      }
    } else {
      syncSettingsUI();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
