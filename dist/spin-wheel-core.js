/*!
 * spin-wheel (Classic IIFE Port) v5.0.2
 * https://github.com/CrazyTim/spin-wheel#readme
 *
 * MIT License
 *
 * Copyright (c) 2020 CrazyTim
 * Copyright (c) CrazyTim 2024.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/*
 * Easing functions from spin-wheel/scripts/easing.js:
 *
 * Copyright 2010-2021 Mike Bostock
 * Copyright 2001 Robert Penner
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *
 * * Redistributions of source code must retain the above copyright notice, this
 *   list of conditions and the following disclaimer.
 *
 * * Redistributions in binary form must reproduce the above copyright notice,
 *   this list of conditions and the following disclaimer in the documentation
 *   and/or other materials provided with the distribution.
 *
 * * Neither the name of the author nor the names of contributors may be used to
 *   endorse or promote products derived from this software without specific prior
 *   written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
 * ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
(function (root) {
  'use strict';

  var arcAdjust = -90;
  var baseCanvasSize = 500;
  var dragCapturePeriod = 250;

  var AlignText = Object.freeze({
    left: 'left',
    right: 'right',
    center: 'center'
  });

  var Defaults = Object.freeze({
    wheel: {
      borderColor: '#000',
      borderWidth: 1,
      debug: false,
      image: null,
      isInteractive: true,
      itemBackgroundColors: ['#fff'],
      itemLabelAlign: AlignText.right,
      itemLabelBaselineOffset: 0,
      itemLabelColors: ['#000'],
      itemLabelFont: 'sans-serif',
      itemLabelFontSizeMax: baseCanvasSize,
      itemLabelRadius: 0.85,
      itemLabelRadiusMax: 0.2,
      itemLabelRotation: 0,
      itemLabelStrokeColor: '#fff',
      itemLabelStrokeWidth: 0,
      items: [],
      lineColor: '#000',
      lineWidth: 1,
      pixelRatio: 0,
      radius: 0.95,
      rotation: 0,
      rotationResistance: -35,
      rotationSpeedMax: 300,
      offset: { x: 0, y: 0 },
      onCurrentIndexChange: null,
      onRest: null,
      onSpin: null,
      overlayImage: null,
      pointerAngle: 0
    },
    item: {
      backgroundColor: null,
      image: null,
      imageOpacity: 1,
      imageRadius: 0.5,
      imageRotation: 0,
      imageScale: 1,
      label: '',
      labelColor: null,
      value: null,
      weight: 1
    }
  });

  var Debugging = Object.freeze({
    pointerLineColor: '#ff00ff',
    labelBoundingBoxColor: '#ff00ff',
    labelRadiusColor: '#00ff00',
    dragPointHue: 300
  });

  // ---------------------------------------------------------------------------
  // Easing functions
  // ---------------------------------------------------------------------------
  function tpmt(x) {
    return (Math.pow(2, -10 * x) - 0.0009765625) * 1.0009775171065494;
  }

  var pi = Math.PI;
  var b1 = 4 / 11;
  var b2 = 6 / 11;
  var b3 = 8 / 11;
  var b4 = 3 / 4;
  var b5 = 9 / 11;
  var b6 = 10 / 11;
  var b7 = 15 / 16;
  var b8 = 21 / 22;
  var b9 = 63 / 64;
  var b0 = 1 / b1 / b1;
  var tau = 2 * Math.PI;
  var defaultAmp = 1;
  var defaultPeriod = 0.3;

  function sinInOut(t) {
    return (1 - Math.cos(pi * t)) / 2;
  }

  function cubicOut(t) {
    return --t * t * t + 1;
  }

  function cubicInOut(t) {
    return ((t *= 2) <= 1 ? t * t * t : (t -= 2) * t * t + 2) / 2;
  }

  var elasticInOut = (function custom(a, p) {
    var s = Math.asin(1 / (a = Math.max(1, a))) * (p /= tau);

    function fn(t) {
      return ((t = t * 2 - 1) < 0
        ? a * tpmt(-t) * Math.sin((s - t) / p)
        : 2 - a * tpmt(t) * Math.sin((s + t) / p)) / 2;
    }

    fn.amplitude = function (amp) { return custom(amp, p * tau); };
    fn.period = function (per) { return custom(a, per); };

    return fn;
  })(defaultAmp, defaultPeriod);

  function bounceOut(t) {
    return (t = +t) < b1
      ? b0 * t * t
      : t < b3
        ? b0 * (t -= b2) * t + b4
        : t < b6
          ? b0 * (t -= b5) * t + b7
          : b0 * (t -= b8) * t + b9;
  }

  function easeSinOut(n) {
    return Math.sin((n * Math.PI) / 2);
  }

  var easing = {
    sinInOut: sinInOut,
    cubicOut: cubicOut,
    cubicInOut: cubicInOut,
    elasticInOut: elasticInOut,
    bounceOut: bounceOut,
    sinOut: easeSinOut
  };

  // ---------------------------------------------------------------------------
  // Compatibility & environment helpers
  // ---------------------------------------------------------------------------
  function getWindow() {
    if (typeof window !== 'undefined') {
      return window;
    }
    return root || null;
  }

  function getNow() {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }
    return Date.now();
  }

  function isDomElement(el) {
    if (!el || typeof el !== 'object') {
      return false;
    }
    if (typeof Element === 'function') {
      return el instanceof Element;
    }
    return typeof el.appendChild === 'function' && typeof el.removeChild === 'function';
  }

  function isHtmlImageElement(val) {
    if (!val || typeof val !== 'object') {
      return false;
    }
    if (typeof HTMLImageElement === 'function') {
      return val instanceof HTMLImageElement;
    }
    return val.tagName === 'IMG' || (typeof val.width === 'number' && typeof val.height === 'number');
  }

  var supportsPassive = false;
  (function detectPassive() {
    var win = getWindow();
    if (!win || typeof win.addEventListener !== 'function') {
      return;
    }
    try {
      var opts = Object.defineProperty({}, 'passive', {
        get: function () {
          supportsPassive = true;
          return false;
        }
      });
      var noop = function () {};
      win.addEventListener('testpassive', noop, opts);
      win.removeEventListener('testpassive', noop, opts);
    } catch (e) {}
  })();

  // ---------------------------------------------------------------------------
  // Utilities (ported from src/util.js)
  // ---------------------------------------------------------------------------
  function getRandomFloat(min, max, round) {
    var lo = min === undefined ? 0 : min;
    var hi = max === undefined ? 0 : max;
    var r = round === undefined ? 14 : round;
    return parseFloat((Math.random() * (hi - lo) + lo).toFixed(r));
  }

  function degRad(degrees) {
    var d = degrees === undefined ? 0 : degrees;
    return d * Math.PI / 180;
  }

  function isAngleBetween(angle, arcStart, arcEnd) {
    if (arcStart < arcEnd) {
      return arcStart <= angle && angle < arcEnd;
    }
    return arcStart <= angle || angle < arcEnd;
  }

  function getFontSizeToFit(text, fontFamily, maxWidth, canvasContext) {
    if (!text || typeof text !== 'string' || !text.replace(/^\s+|\s+$/g, '')) {
      return Infinity;
    }
    if (!canvasContext || typeof canvasContext.measureText !== 'function') {
      return Infinity;
    }
    if (typeof maxWidth !== 'number' || !Number.isFinite(maxWidth) || maxWidth <= 0) {
      return 1;
    }
    canvasContext.save();
    canvasContext.font = '1px ' + fontFamily;
    var metrics = canvasContext.measureText(text);
    var w = metrics && typeof metrics.width === 'number' ? metrics.width : 0;
    canvasContext.restore();
    if (!w || w <= 0 || !Number.isFinite(w)) {
      return Infinity;
    }
    return maxWidth / w;
  }

  function isPointInCircle(point, cx, cy, radius) {
    var p = point || { x: 0, y: 0 };
    var dx = p.x - cx;
    var dy = p.y - cy;
    return (dx * dx) + (dy * dy) <= (radius * radius);
  }

  function translateXYToElement(point, element, devicePixelRatio) {
    var p = point || { x: 0, y: 0 };
    var el = element || {};
    var dpr = devicePixelRatio === undefined ? 1 : devicePixelRatio;
    var rect = typeof el.getBoundingClientRect === 'function'
      ? el.getBoundingClientRect()
      : { left: 0, top: 0 };
    return {
      x: (p.x - rect.left) * dpr,
      y: (p.y - rect.top) * dpr
    };
  }

  function getAngle(originX, originY, targetX, targetY) {
    var dx = originX - targetX;
    var dy = originY - targetY;
    var theta = Math.atan2(-dy, -dx);
    theta *= 180 / Math.PI;
    if (theta < 0) {
      theta += 360;
    }
    return theta;
  }

  function addAngle(a, b) {
    var sum = (a === undefined ? 0 : a) + (b === undefined ? 0 : b);
    var result;
    if (sum > 0) {
      result = sum % 360;
    } else {
      result = 360 + (sum % 360);
    }
    if (result === 360) {
      result = 0;
    }
    return result;
  }

  function diffAngle(a, b) {
    var av = a === undefined ? 0 : a;
    var bv = b === undefined ? 0 : b;
    var offsetFrom180 = 180 - bv;
    var aWithOffset = addAngle(av, offsetFrom180);
    return 180 - aWithOffset;
  }

  function calcWheelRotationForTargetAngle(currentRotation, targetAngle, direction) {
    var cur = currentRotation === undefined ? 0 : currentRotation;
    var tgt = targetAngle === undefined ? 0 : targetAngle;
    var dir = direction === undefined ? 1 : direction;

    var angle = ((cur % 360) + tgt) % 360;
    angle = fixFloat(angle);
    angle = ((dir === 1) ? (360 - angle) : 360 + angle) % 360;
    angle *= dir;

    return cur + angle;
  }

  function isObject(v) {
    return typeof v === 'object' && !Array.isArray(v) && v !== null;
  }

  function isNumber(n) {
    return typeof n === 'number' && !Number.isNaN(n);
  }

  function setProp(cfg) {
    var val = cfg.val;
    var isValid = cfg.isValid;
    var errorMessage = cfg.errorMessage;
    var defaultValue = cfg.defaultValue;
    var action = cfg.action || null;

    if (isValid) {
      return action ? action() : val;
    }
    if (val === undefined) {
      return defaultValue;
    }
    throw new Error(errorMessage);
  }

  function fixFloat(f) {
    var n = f === undefined ? 0 : f;
    return Number(n.toFixed(9));
  }

  function getResizeObserver(element, callBack) {
    var cb = typeof callBack === 'function' ? callBack : function () {};

    if (typeof window !== 'undefined' && typeof window.ResizeObserver === 'function') {
      var observer = new window.ResizeObserver(function () {
        cb({ redraw: true });
      });
      observer.observe(element);
      return {
        stop: function () {
          try {
            observer.unobserve(element);
          } catch (e) {}
          try {
            observer.disconnect();
          } catch (e) {}
        }
      };
    }

    var win = getWindow();
    var onWindowResize = function () {
      cb({ redraw: true });
    };

    if (win && typeof win.addEventListener === 'function') {
      win.addEventListener('resize', onWindowResize);
    }

    return {
      stop: function () {
        if (win && typeof win.removeEventListener === 'function') {
          win.removeEventListener('resize', onWindowResize);
        }
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Canvas path helper (Path2D with fallback for minimal Canvas mocks)
  // ---------------------------------------------------------------------------
  function createWedgePath(cx, cy, radius, startRad, endRad) {
    var safeRadius = radius > 0 ? radius : 0;
    if (typeof Path2D === 'function') {
      var path = new Path2D();
      path.moveTo(cx, cy);
      path.arc(cx, cy, safeRadius, startRad, endRad);
      return path;
    }
    return {
      cx: cx,
      cy: cy,
      r: safeRadius,
      startRad: startRad,
      endRad: endRad
    };
  }

  function fillWedgePath(ctx, path) {
    if (typeof Path2D === 'function' && path instanceof Path2D) {
      ctx.fill(path);
      return;
    }
    ctx.beginPath();
    ctx.moveTo(path.cx, path.cy);
    ctx.arc(path.cx, path.cy, path.r, path.startRad, path.endRad);
    ctx.closePath();
    ctx.fill();
  }

  function clipWedgePath(ctx, path) {
    if (typeof Path2D === 'function' && path instanceof Path2D) {
      ctx.clip(path);
      return;
    }
    ctx.beginPath();
    ctx.moveTo(path.cx, path.cy);
    ctx.arc(path.cx, path.cy, path.r, path.startRad, path.endRad);
    ctx.closePath();
    ctx.clip();
  }

  // ---------------------------------------------------------------------------
  // Events (ported from src/events.js with Chrome 61 / WebView guards)
  // ---------------------------------------------------------------------------
  function cleanupMediaQueryListener(wheel) {
    var mql = wheel._mediaQueryList;
    var handler = wheel._handler_onDevicePixelRatioChange;
    if (!mql || !handler) {
      wheel._mediaQueryList = null;
      return;
    }
    try {
      if (typeof mql.removeEventListener === 'function') {
        mql.removeEventListener('change', handler);
      } else if (typeof mql.removeListener === 'function') {
        mql.removeListener(handler);
      }
    } catch (e) {}
    wheel._mediaQueryList = null;
  }

  function registerEvents(wheel) {
    registerPointerEvents(wheel);

    wheel._handler_onResize = getResizeObserver(wheel._canvasContainer, function (opts) {
      var redraw = (!opts || opts.redraw === undefined) ? true : opts.redraw;
      wheel.resize();
      if (redraw) {
        wheel.draw(getNow());
      }
    });

    var win = getWindow();
    var listenForDevicePixelRatioChange = function () {
      cleanupMediaQueryListener(wheel);
      if (!win || typeof win.matchMedia !== 'function') {
        return;
      }
      var dpr = win.devicePixelRatio || 1;
      try {
        var mql = win.matchMedia('(resolution: ' + dpr + 'dppx)');
        if (!mql) {
          return;
        }
        wheel._mediaQueryList = mql;
        if (typeof mql.addEventListener === 'function') {
          mql.addEventListener('change', wheel._handler_onDevicePixelRatioChange);
        } else if (typeof mql.addListener === 'function') {
          mql.addListener(wheel._handler_onDevicePixelRatioChange);
        }
      } catch (e) {
        wheel._mediaQueryList = null;
      }
    };

    wheel._handler_onDevicePixelRatioChange = function () {
      cleanupMediaQueryListener(wheel);
      wheel.resize();
      listenForDevicePixelRatioChange();
    };

    listenForDevicePixelRatioChange();
  }

  function unregisterEvents(wheel) {
    var canvas = wheel.canvas;
    var win = getWindow();

    if (typeof wheel._cleanupActiveDrag === 'function') {
      wheel._cleanupActiveDrag();
      wheel._cleanupActiveDrag = null;
    }

    if (canvas) {
      if (win && 'PointerEvent' in win) {
        canvas.removeEventListener('pointerdown', wheel._handler_onPointerDown);
        canvas.removeEventListener('pointermove', wheel._handler_onPointerMoveRefreshCursor);
      } else {
        canvas.removeEventListener('touchstart', wheel._handler_onTouchStart);
        canvas.removeEventListener('mousedown', wheel._handler_onMouseDown);
        canvas.removeEventListener('mousemove', wheel._handler_onMouseMoveRefreshCursor);
      }
    }

    if (wheel._handler_onResize && typeof wheel._handler_onResize.stop === 'function') {
      wheel._handler_onResize.stop();
    }
    wheel._handler_onResize = null;

    cleanupMediaQueryListener(wheel);
  }

  function registerPointerEvents(wheel) {
    var canvas = wheel.canvas;
    var win = getWindow();
    var touchListenOpts = supportsPassive ? { passive: false } : false;

    wheel._handler_onPointerMoveRefreshCursor = function (e) {
      var evt = e || {};
      var point = { x: evt.clientX, y: evt.clientY };
      wheel._isCursorOverWheel = wheel.wheelHitTest(point);
      wheel.refreshCursor();
    };

    wheel._handler_onMouseMoveRefreshCursor = function (e) {
      var evt = e || {};
      var point = { x: evt.clientX, y: evt.clientY };
      wheel._isCursorOverWheel = wheel.wheelHitTest(point);
      wheel.refreshCursor();
    };

    wheel._handler_onPointerDown = function (e) {
      var evt = e || {};
      var point = { x: evt.clientX, y: evt.clientY };

      if (!wheel.isInteractive) return;
      if (!wheel.wheelHitTest(point)) return;

      if (typeof evt.preventDefault === 'function') evt.preventDefault();
      wheel.dragStart(point);

      try {
        if (typeof canvas.setPointerCapture === 'function' && evt.pointerId !== undefined) {
          canvas.setPointerCapture(evt.pointerId);
        }
      } catch (err) {}

      function onPointerMove(moveEvt) {
        var me = moveEvt || {};
        if (typeof me.preventDefault === 'function') me.preventDefault();
        wheel.dragMove({ x: me.clientX, y: me.clientY });
      }

      function detachPointerListeners(upEvt) {
        try {
          if (upEvt && typeof canvas.releasePointerCapture === 'function' && upEvt.pointerId !== undefined) {
            canvas.releasePointerCapture(upEvt.pointerId);
          }
        } catch (err) {}
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('pointerup', onPointerUp);
        canvas.removeEventListener('pointercancel', onPointerUp);
        canvas.removeEventListener('pointerout', onPointerUp);
        if (wheel._cleanupActiveDrag === detachPointerListeners) {
          wheel._cleanupActiveDrag = null;
        }
      }

      function onPointerUp(upEvt) {
        var ue = upEvt || {};
        if (typeof ue.preventDefault === 'function') ue.preventDefault();
        detachPointerListeners(ue);
        wheel.dragEnd();
      }

      wheel._cleanupActiveDrag = detachPointerListeners;
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerup', onPointerUp);
      canvas.addEventListener('pointercancel', onPointerUp);
      canvas.addEventListener('pointerout', onPointerUp);
    };

    wheel._handler_onMouseDown = function (e) {
      var evt = e || {};
      var point = { x: evt.clientX, y: evt.clientY };

      if (!wheel.isInteractive) return;
      if (!wheel.wheelHitTest(point)) return;

      wheel.dragStart(point);

      function onMouseMove(moveEvt) {
        var me = moveEvt || {};
        if (typeof me.preventDefault === 'function') me.preventDefault();
        wheel.dragMove({ x: me.clientX, y: me.clientY });
      }

      function detachMouseListeners() {
        if (typeof document !== 'undefined') {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
        }
        if (wheel._cleanupActiveDrag === detachMouseListeners) {
          wheel._cleanupActiveDrag = null;
        }
      }

      function onMouseUp(upEvt) {
        var ue = upEvt || {};
        if (typeof ue.preventDefault === 'function') ue.preventDefault();
        detachMouseListeners();
        wheel.dragEnd();
      }

      wheel._cleanupActiveDrag = detachMouseListeners;
      if (typeof document !== 'undefined') {
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      }
    };

    wheel._handler_onTouchStart = function (e) {
      var evt = e || {};
      if (!evt.targetTouches || !evt.targetTouches.length) return;
      var touch = evt.targetTouches[0];
      var point = { x: touch.clientX, y: touch.clientY };

      if (!wheel.isInteractive) return;
      if (!wheel.wheelHitTest(point)) return;

      if (typeof evt.preventDefault === 'function') evt.preventDefault();
      wheel.dragStart(point);

      function onTouchMove(moveEvt) {
        var me = moveEvt || {};
        if (!me.targetTouches || !me.targetTouches.length) return;
        if (typeof me.preventDefault === 'function') me.preventDefault();
        wheel.dragMove({
          x: me.targetTouches[0].clientX,
          y: me.targetTouches[0].clientY
        });
      }

      function detachTouchListeners() {
        canvas.removeEventListener('touchmove', onTouchMove, touchListenOpts);
        canvas.removeEventListener('touchend', onTouchEnd);
        canvas.removeEventListener('touchcancel', onTouchEnd);
        if (wheel._cleanupActiveDrag === detachTouchListeners) {
          wheel._cleanupActiveDrag = null;
        }
      }

      function onTouchEnd(endEvt) {
        var ee = endEvt || {};
        if (typeof ee.preventDefault === 'function') ee.preventDefault();
        detachTouchListeners();
        wheel.dragEnd();
      }

      wheel._cleanupActiveDrag = detachTouchListeners;
      canvas.addEventListener('touchmove', onTouchMove, touchListenOpts);
      canvas.addEventListener('touchend', onTouchEnd);
      canvas.addEventListener('touchcancel', onTouchEnd);
    };

    if (win && 'PointerEvent' in win) {
      canvas.addEventListener('pointerdown', wheel._handler_onPointerDown);
      canvas.addEventListener('pointermove', wheel._handler_onPointerMoveRefreshCursor);
    } else {
      canvas.addEventListener('touchstart', wheel._handler_onTouchStart, touchListenOpts);
      canvas.addEventListener('mousedown', wheel._handler_onMouseDown);
      canvas.addEventListener('mousemove', wheel._handler_onMouseMoveRefreshCursor);
    }
  }

  // ---------------------------------------------------------------------------
  // Item class (ported from src/item.js)
  // ---------------------------------------------------------------------------
  class Item {
    constructor(wheel, props) {
      var itemProps = props === undefined ? {} : props;

      if (!isObject(wheel)) {
        throw new Error('wheel must be an instance of Wheel');
      }
      if (!isObject(itemProps) && itemProps !== null) {
        throw new Error('props must be an Object or null');
      }

      this._wheel = wheel;

      var keys = Object.keys(Defaults.item);
      var i;
      for (i = 0; i < keys.length; i += 1) {
        var key = keys[i];
        this['_' + key] = Defaults.item[key];
      }

      if (itemProps) {
        this.init(itemProps);
      } else {
        this.init(Defaults.item);
      }
    }

    init(props) {
      var p = props || {};
      this.backgroundColor = p.backgroundColor;
      this.image = p.image;
      this.imageOpacity = p.imageOpacity;
      this.imageRadius = p.imageRadius;
      this.imageRotation = p.imageRotation;
      this.imageScale = p.imageScale;
      this.label = p.label;
      this.labelColor = p.labelColor;
      this.value = p.value;
      this.weight = p.weight;
    }

    get backgroundColor() {
      return this._backgroundColor;
    }
    set backgroundColor(val) {
      if (typeof val === 'string') {
        this._backgroundColor = val;
      } else {
        this._backgroundColor = Defaults.item.backgroundColor;
      }
      this._wheel.refresh();
    }

    get image() {
      return this._image;
    }
    set image(val) {
      if (isHtmlImageElement(val)) {
        this._image = val;
      } else {
        this._image = Defaults.item.image;
      }
      this._wheel.refresh();
    }

    get imageOpacity() {
      return this._imageOpacity;
    }
    set imageOpacity(val) {
      if (typeof val === 'number') {
        this._imageOpacity = val;
      } else {
        this._imageOpacity = Defaults.item.imageOpacity;
      }
      this._wheel.refresh();
    }

    get imageRadius() {
      return this._imageRadius;
    }
    set imageRadius(val) {
      if (typeof val === 'number') {
        this._imageRadius = val;
      } else {
        this._imageRadius = Defaults.item.imageRadius;
      }
      this._wheel.refresh();
    }

    get imageRotation() {
      return this._imageRotation;
    }
    set imageRotation(val) {
      if (typeof val === 'number') {
        this._imageRotation = val;
      } else {
        this._imageRotation = Defaults.item.imageRotation;
      }
      this._wheel.refresh();
    }

    get imageScale() {
      return this._imageScale;
    }
    set imageScale(val) {
      if (typeof val === 'number') {
        this._imageScale = val;
      } else {
        this._imageScale = Defaults.item.imageScale;
      }
      this._wheel.refresh();
    }

    get label() {
      return this._label;
    }
    set label(val) {
      if (typeof val === 'string') {
        this._label = val;
      } else {
        this._label = Defaults.item.label;
      }
      this._wheel.refresh();
    }

    get labelColor() {
      return this._labelColor;
    }
    set labelColor(val) {
      if (typeof val === 'string') {
        this._labelColor = val;
      } else {
        this._labelColor = Defaults.item.labelColor;
      }
      this._wheel.refresh();
    }

    get value() {
      return this._value;
    }
    set value(val) {
      if (val !== undefined) {
        this._value = val;
      } else {
        this._value = Defaults.item.value;
      }
    }

    get weight() {
      return this._weight;
    }
    set weight(val) {
      if (typeof val === 'number') {
        this._weight = val;
      } else {
        this._weight = Defaults.item.weight;
      }
    }

    getIndex() {
      var items = this._wheel.items;
      var index = -1;
      var i;
      for (i = 0; i < items.length; i += 1) {
        if (items[i] === this) {
          index = i;
          break;
        }
      }
      if (index === -1) {
        throw new Error('Item not found in parent Wheel');
      }
      return index;
    }

    getCenterAngle() {
      var angle = this._wheel.getItemAngles()[this.getIndex()];
      return angle.start + ((angle.end - angle.start) / 2);
    }

    getStartAngle() {
      return this._wheel.getItemAngles()[this.getIndex()].start;
    }

    getEndAngle() {
      return this._wheel.getItemAngles()[this.getIndex()].end;
    }

    getRandomAngle() {
      return getRandomFloat(this.getStartAngle(), this.getEndAngle());
    }
  }

  // ---------------------------------------------------------------------------
  // Wheel class (ported from src/wheel.js)
  // ---------------------------------------------------------------------------
  class Wheel {
    constructor(container, props) {
      var wheelProps = props === undefined ? {} : props;

      if (!isDomElement(container)) {
        throw new Error('container must be an instance of Element');
      }
      if (!isObject(wheelProps) && wheelProps !== null) {
        throw new Error('props must be an Object or null');
      }

      this._frameRequestId = null;
      this._rotationSpeed = 0;
      this._rotationDirection = 1;
      this._spinToTimeEnd = null;
      this._lastSpinFrameTime = null;
      this._isCursorOverWheel = false;
      this._size = 0;
      this._actualRadius = 0;
      this._center = { x: 0, y: 0 };
      this._itemLabelFontSize = 12;
      this._labelMaxWidth = 0;
      this._dragEvents = [];
      this._currentIndex = -1;
      this.isDragging = false;

      this.add(container);

      var keys = Object.keys(Defaults.wheel);
      var i;
      for (i = 0; i < keys.length; i += 1) {
        var key = keys[i];
        this['_' + key] = Defaults.wheel[key];
      }

      if (wheelProps) {
        this.init(wheelProps);
      } else {
        this.init(Defaults.wheel);
      }
    }

    init(props) {
      var p = props || {};
      this._isInitialising = true;

      this.borderColor = p.borderColor;
      this.borderWidth = p.borderWidth;
      this.debug = p.debug;
      this.image = p.image;
      this.isInteractive = p.isInteractive;
      this.itemBackgroundColors = p.itemBackgroundColors;
      this.itemLabelAlign = p.itemLabelAlign;
      this.itemLabelBaselineOffset = p.itemLabelBaselineOffset;
      this.itemLabelColors = p.itemLabelColors;
      this.itemLabelFont = p.itemLabelFont;
      this.itemLabelFontSizeMax = p.itemLabelFontSizeMax;
      this.itemLabelRadius = p.itemLabelRadius;
      this.itemLabelRadiusMax = p.itemLabelRadiusMax;
      this.itemLabelRotation = p.itemLabelRotation;
      this.itemLabelStrokeColor = p.itemLabelStrokeColor;
      this.itemLabelStrokeWidth = p.itemLabelStrokeWidth;
      this.items = p.items;
      this.lineColor = p.lineColor;
      this.lineWidth = p.lineWidth;
      this.pixelRatio = p.pixelRatio;
      this.rotationSpeedMax = p.rotationSpeedMax;
      this.radius = p.radius;
      this.rotation = p.rotation;
      this.rotationResistance = p.rotationResistance;
      this.offset = p.offset;
      this.onCurrentIndexChange = p.onCurrentIndexChange;
      this.onRest = p.onRest;
      this.onSpin = p.onSpin;
      this.overlayImage = p.overlayImage;
      this.pointerAngle = p.pointerAngle;
    }

    add(container) {
      this._canvasContainer = container;
      this.canvas = document.createElement('canvas');
      this.canvas.style.display = 'block';
      this._context = this.canvas.getContext('2d');
      this._canvasContainer.appendChild(this.canvas);
      registerEvents(this);
      if (this._isInitialising === false) {
        this.resize();
      }
    }

    remove() {
      if (this.canvas === null) return;
      if (this._frameRequestId !== null) {
        var win = getWindow();
        if (win && typeof win.cancelAnimationFrame === 'function') {
          win.cancelAnimationFrame(this._frameRequestId);
        } else {
          clearTimeout(this._frameRequestId);
        }
        this._frameRequestId = null;
      }
      unregisterEvents(this);
      if (this._canvasContainer && this.canvas.parentNode === this._canvasContainer) {
        this._canvasContainer.removeChild(this.canvas);
      }
      this._canvasContainer = null;
      this.canvas = null;
      this._context = null;
    }

    resize() {
      if (this.canvas === null || !this._canvasContainer) return;

      var cw = this._canvasContainer.clientWidth || 0;
      var ch = this._canvasContainer.clientHeight || 0;

      if (cw <= 0 || ch <= 0) {
        this._size = 0;
        this._actualRadius = 0;
        return;
      }

      this.canvas.style.width = cw + 'px';
      this.canvas.style.height = ch + 'px';

      var dpr = this.getActualPixelRatio();
      var w = cw * dpr;
      var h = ch * dpr;
      this.canvas.width = w;
      this.canvas.height = h;

      var min = Math.min(w, h);
      var wheelSize = {
        w: min - (min * this._offset.x),
        h: min - (min * this._offset.y)
      };

      if (wheelSize.w <= 0 || wheelSize.h <= 0) {
        this._size = 0;
        this._actualRadius = 0;
        return;
      }

      var scale = Math.min(w / wheelSize.w, h / wheelSize.h);
      this._size = Math.max(wheelSize.w * scale, wheelSize.h * scale);

      this._center = {
        x: w / 2 + (w * this._offset.x),
        y: h / 2 + (h * this._offset.y)
      };

      this._actualRadius = (this._size / 2) * this.radius;

      this._itemLabelFontSize = this.itemLabelFontSizeMax * (this._size / baseCanvasSize);
      this._labelMaxWidth = this._actualRadius * (this.itemLabelRadius - this.itemLabelRadiusMax);

      if (this.itemLabelAlign === 'center') {
        this._labelMaxWidth *= 2;
      }

      var i;
      for (i = 0; i < this._items.length; i += 1) {
        var fitSize = getFontSizeToFit(
          this._items[i].label,
          this.itemLabelFont,
          this._labelMaxWidth,
          this._context
        );
        if (Number.isFinite(fitSize) && fitSize > 0) {
          this._itemLabelFontSize = Math.min(this._itemLabelFontSize, fitSize);
        }
      }

      this.refresh();
    }

    draw(now) {
      var ts = now === undefined ? 0 : now;
      this._frameRequestId = null;

      if (this._context === null || this.canvas === null) return;

      var ctx = this._context;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      this.animateRotation(ts);

      if (this._actualRadius <= 0 || this.canvas.width <= 0 || this.canvas.height <= 0) {
        this._isInitialising = false;
        return;
      }

      var angles = this.getItemAngles(this._rotation);
      var actualBorderWidth = this.getScaledNumber(this._borderWidth);
      var wedgeRadius = Math.max(0, this._actualRadius - (actualBorderWidth / 2));

      ctx.textBaseline = 'middle';
      ctx.textAlign = this.itemLabelAlign;
      ctx.font = this._itemLabelFontSize + 'px ' + this.itemLabelFont;

      var i;
      for (i = 0; i < angles.length; i += 1) {
        var a = angles[i];
        var item = this._items[i];
        item.path = createWedgePath(
          this._center.x,
          this._center.y,
          wedgeRadius,
          degRad(a.start + arcAdjust),
          degRad(a.end + arcAdjust)
        );
      }

      this.drawItemBackgrounds(ctx, angles);
      this.drawItemImages(ctx, angles);
      this.drawItemLines(ctx, angles);
      this.drawItemLabels(ctx, angles);
      this.drawBorder(ctx);
      this.drawImage(ctx, this._image, false);
      this.drawImage(ctx, this._overlayImage, true);
      this.drawDebugPointerLine(ctx);

      this._isInitialising = false;
    }

    drawItemBackgrounds(ctx, angles) {
      var list = angles || [];
      var i;
      for (i = 0; i < list.length; i += 1) {
        var item = this._items[i];
        var bg = (item.backgroundColor !== null && item.backgroundColor !== undefined)
          ? item.backgroundColor
          : this._itemBackgroundColors[i % this._itemBackgroundColors.length];
        ctx.fillStyle = bg;
        fillWedgePath(ctx, item.path);
      }
    }

    drawItemImages(ctx, angles) {
      var list = angles || [];
      var i;
      for (i = 0; i < list.length; i += 1) {
        var a = list[i];
        var item = this._items[i];
        if (item.image === null) continue;

        ctx.save();
        clipWedgePath(ctx, item.path);

        var angle = a.start + ((a.end - a.start) / 2);
        ctx.translate(
          this._center.x + Math.cos(degRad(angle + arcAdjust)) * (this._actualRadius * item.imageRadius),
          this._center.y + Math.sin(degRad(angle + arcAdjust)) * (this._actualRadius * item.imageRadius)
        );
        ctx.rotate(degRad(angle + item.imageRotation));
        ctx.globalAlpha = item.imageOpacity;

        var width = (this._size / 500) * item.image.width * item.imageScale;
        var height = (this._size / 500) * item.image.height * item.imageScale;
        ctx.drawImage(item.image, -width / 2, -height / 2, width, height);

        ctx.restore();
      }
    }

    drawImage(ctx, image, isOverlay) {
      if (image === null) return;
      var overlay = Boolean(isOverlay);

      ctx.translate(this._center.x, this._center.y);
      if (!overlay) {
        ctx.rotate(degRad(this._rotation));
      }

      var size = overlay ? this._size : this._size * this.radius;
      var sizeHalf = -(size / 2);
      ctx.drawImage(image, sizeHalf, sizeHalf, size, size);

      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    drawDebugPointerLine(ctx) {
      if (!this.debug) return;

      ctx.translate(this._center.x, this._center.y);
      ctx.rotate(degRad(this._pointerAngle + arcAdjust));

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(this._actualRadius * 2, 0);

      ctx.strokeStyle = Debugging.pointerLineColor;
      ctx.lineWidth = this.getScaledNumber(2);
      ctx.stroke();

      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    drawBorder(ctx) {
      if (this._borderWidth <= 0) return;

      var actualBorderWidth = this.getScaledNumber(this._borderWidth);
      var actualBorderColor = this._borderColor || 'transparent';
      var borderRadius = Math.max(0, this._actualRadius - (actualBorderWidth / 2));

      ctx.beginPath();
      ctx.strokeStyle = actualBorderColor;
      ctx.lineWidth = actualBorderWidth;
      ctx.arc(this._center.x, this._center.y, borderRadius, 0, 2 * Math.PI);
      ctx.stroke();

      if (this.debug) {
        var actualDebugLineWidth = this.getScaledNumber(1);

        ctx.beginPath();
        ctx.strokeStyle = Debugging.labelRadiusColor;
        ctx.lineWidth = actualDebugLineWidth;
        ctx.arc(this._center.x, this._center.y, this._actualRadius * this.itemLabelRadius, 0, 2 * Math.PI);
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = Debugging.labelRadiusColor;
        ctx.lineWidth = actualDebugLineWidth;
        ctx.arc(this._center.x, this._center.y, this._actualRadius * this.itemLabelRadiusMax, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }

    drawItemLines(ctx, angles) {
      if (this._lineWidth <= 0) return;
      var list = angles || [];
      var actualLineWidth = this.getScaledNumber(this._lineWidth);
      var actualBorderWidth = this.getScaledNumber(this._borderWidth);
      var lineLen = Math.max(0, this._actualRadius - actualBorderWidth);

      ctx.translate(this._center.x, this._center.y);

      var i;
      for (i = 0; i < list.length; i += 1) {
        var angle = list[i];
        var rad = degRad(angle.start + arcAdjust);
        ctx.rotate(rad);

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(lineLen, 0);

        ctx.strokeStyle = this.lineColor;
        ctx.lineWidth = actualLineWidth;
        ctx.stroke();

        ctx.rotate(-rad);
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    drawItemLabels(ctx, angles) {
      var list = angles || [];
      var actualItemLabelBaselineOffset = this._itemLabelFontSize * -this.itemLabelBaselineOffset;
      var actualDebugLineWidth = this.getScaledNumber(1);
      var actualLabelStrokeWidth = this.getScaledNumber(this._itemLabelStrokeWidth * 2);

      var i;
      for (i = 0; i < list.length; i += 1) {
        var a = list[i];
        var item = this._items[i];
        var actualLabelColor = item.labelColor
          || this._itemLabelColors[i % this._itemLabelColors.length]
          || 'transparent';

        if (item.label.trim() === '' || actualLabelColor === 'transparent') continue;

        ctx.save();
        clipWedgePath(ctx, item.path);

        var angle = a.start + ((a.end - a.start) / 2);

        ctx.translate(
          this._center.x + Math.cos(degRad(angle + arcAdjust)) * (this._actualRadius * this.itemLabelRadius),
          this._center.y + Math.sin(degRad(angle + arcAdjust)) * (this._actualRadius * this.itemLabelRadius)
        );

        ctx.rotate(degRad(angle + arcAdjust));
        ctx.rotate(degRad(this.itemLabelRotation));

        if (this.debug) {
          ctx.save();
          var alignAdjust = 0;
          if (this.itemLabelAlign === 'left') {
            alignAdjust = this._labelMaxWidth;
          } else if (this.itemLabelAlign === 'center') {
            alignAdjust = this._labelMaxWidth / 2;
          }

          ctx.beginPath();
          ctx.moveTo(alignAdjust, 0);
          ctx.lineTo(-this._labelMaxWidth + alignAdjust, 0);
          ctx.strokeStyle = Debugging.labelBoundingBoxColor;
          ctx.lineWidth = actualDebugLineWidth;
          ctx.stroke();

          ctx.strokeRect(alignAdjust, -this._itemLabelFontSize / 2, -this._labelMaxWidth, this._itemLabelFontSize);
          ctx.restore();
        }

        if (this._itemLabelStrokeWidth > 0) {
          ctx.lineWidth = actualLabelStrokeWidth;
          ctx.strokeStyle = this._itemLabelStrokeColor;
          ctx.lineJoin = 'round';
          ctx.strokeText(item.label, 0, actualItemLabelBaselineOffset);
        }

        ctx.fillStyle = actualLabelColor;
        ctx.fillText(item.label, 0, actualItemLabelBaselineOffset);

        if (this.debug) {
          var circleDiameter = this.getScaledNumber(2);
          ctx.beginPath();
          ctx.arc(0, 0, circleDiameter, 0, 2 * Math.PI);
          ctx.fillStyle = Debugging.labelRadiusColor;
          ctx.fill();
        }

        ctx.restore();
      }
    }

    drawDebugDragPoints(ctx) {
      if (!this.debug || !this._dragEvents || !this._dragEvents.length) return;

      var dragEventsReversed = this._dragEvents.slice().reverse();
      var lineWidth = this.getScaledNumber(0.5);
      var circleDiameter = this.getScaledNumber(4);

      var i;
      for (i = 0; i < dragEventsReversed.length; i += 1) {
        var event = dragEventsReversed[i];
        var lightnessPercent = (i / this._dragEvents.length) * 100;
        ctx.beginPath();
        ctx.arc(event.x, event.y, circleDiameter, 0, 2 * Math.PI);
        ctx.fillStyle = 'hsl(' + Debugging.dragPointHue + ',100%,' + lightnessPercent + '%)';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = lineWidth;
        ctx.fill();
        ctx.stroke();
      }
    }

    animateRotation(now) {
      var ts = now === undefined ? 0 : now;

      if (this._spinToTimeEnd !== null) {
        if (ts >= this._spinToTimeEnd) {
          this.rotation = this._spinToEndRotation;
          this._spinToTimeEnd = null;
          this.raiseEvent_onRest();
          return;
        }

        var duration = this._spinToTimeEnd - this._spinToTimeStart;
        var delta = duration > 0 ? (ts - this._spinToTimeStart) / duration : 1;
        if (delta < 0) {
          delta = 0;
        }
        var distance = this._spinToEndRotation - this._spinToStartRotation;
        this.rotation = this._spinToStartRotation + distance * this._spinToEasingFunction(delta);
        this.refresh();
        return;
      }

      if (this._lastSpinFrameTime !== null) {
        var spinDelta = ts - this._lastSpinFrameTime;
        if (spinDelta > 100) {
          spinDelta = 100;
        }
        if (spinDelta > 0) {
          this.rotation += ((spinDelta / 1000) * this._rotationSpeed) % 360;
          this._rotationSpeed = this.getRotationSpeedPlusDrag(spinDelta);

          if (this._rotationSpeed === 0) {
            this.raiseEvent_onRest();
            this._lastSpinFrameTime = null;
          } else {
            this._lastSpinFrameTime = ts;
          }
        }
        this.refresh();
      }
    }

    getRotationSpeedPlusDrag(delta) {
      var d = delta === undefined ? 0 : delta;
      var newRotationSpeed = this._rotationSpeed + ((this.rotationResistance * (d / 1000)) * this._rotationDirection);

      if ((this._rotationDirection === 1 && newRotationSpeed < 0) || (this._rotationDirection === -1 && newRotationSpeed >= 0)) {
        return 0;
      }

      return newRotationSpeed;
    }

    spin(rotationSpeed) {
      var speed = rotationSpeed === undefined ? 0 : rotationSpeed;
      if (!isNumber(speed)) {
        throw new Error('rotationSpeed must be a number');
      }
      this._dragEvents = [];
      this.beginSpin(speed, 'spin');
    }

    spinTo(rotation, duration, easingFunction) {
      var rot = rotation === undefined ? 0 : rotation;
      var dur = duration === undefined ? 0 : duration;
      var ease = easingFunction === undefined ? null : easingFunction;

      if (!isNumber(rot)) {
        throw new Error('Error: rotation must be a number');
      }
      if (!isNumber(dur)) {
        throw new Error('Error: duration must be a number');
      }

      this.stop();
      this._dragEvents = [];
      this.animate(rot, dur, ease);
      this.raiseEvent_onSpin({
        method: 'spinto',
        targetRotation: rot,
        duration: dur
      });
    }

    spinToItem(itemIndex, duration, spinToCenter, numberOfRevolutions, direction, easingFunction) {
      var idx = itemIndex === undefined ? 0 : itemIndex;
      var dur = duration === undefined ? 0 : duration;
      var toCenter = spinToCenter === undefined ? true : spinToCenter;
      var revs = numberOfRevolutions === undefined ? 1 : numberOfRevolutions;
      var dir = direction === undefined ? 1 : direction;
      var ease = easingFunction === undefined ? null : easingFunction;

      this.stop();
      this._dragEvents = [];

      var itemAngle = toCenter ? this.items[idx].getCenterAngle() : this.items[idx].getRandomAngle();
      var newRotation = calcWheelRotationForTargetAngle(this.rotation, itemAngle - this._pointerAngle, dir);
      newRotation += ((revs * 360) * dir);

      this.animate(newRotation, dur, ease);
      this.raiseEvent_onSpin({
        method: 'spintoitem',
        targetItemIndex: idx,
        targetRotation: newRotation,
        duration: dur
      });
    }

    animate(newRotation, duration, easingFunction) {
      this._spinToStartRotation = this.rotation;
      this._spinToEndRotation = newRotation;
      this._spinToTimeStart = getNow();
      this._spinToTimeEnd = this._spinToTimeStart + duration;
      this._spinToEasingFunction = easingFunction || easeSinOut;
      this.refresh();
    }

    stop() {
      this._spinToTimeEnd = null;
      this._rotationSpeed = 0;
      this._lastSpinFrameTime = null;
    }

    getScaledNumber(n) {
      return (n / baseCanvasSize) * this._size;
    }

    getActualPixelRatio() {
      if (this._pixelRatio !== 0) {
        return this._pixelRatio;
      }
      var dpr = (typeof window !== 'undefined' && typeof window.devicePixelRatio === 'number')
        ? window.devicePixelRatio
        : 1;
      return Math.min(dpr || 1, 2);
    }

    wheelHitTest(point) {
      if (this.canvas === null || this._actualRadius <= 0) return false;
      var p = translateXYToElement(point || { x: 0, y: 0 }, this.canvas, this.getActualPixelRatio());
      return isPointInCircle(p, this._center.x, this._center.y, this._actualRadius);
    }

    refreshCursor() {
      if (this.canvas === null) return;
      if (this.isInteractive) {
        if (this.isDragging) {
          this.canvas.style.cursor = 'grabbing';
          return;
        }
        if (this._isCursorOverWheel) {
          this.canvas.style.cursor = 'grab';
          return;
        }
      }
      this.canvas.style.cursor = '';
    }

    getAngleFromCenter(point) {
      var p = point || { x: 0, y: 0 };
      return (getAngle(this._center.x, this._center.y, p.x, p.y) + 90) % 360;
    }

    getCurrentIndex() {
      return this._currentIndex;
    }

    refreshCurrentIndex(angles) {
      var list = angles || [];
      if (this._items.length === 0) {
        this._currentIndex = -1;
        return;
      }

      var i;
      for (i = 0; i < list.length; i += 1) {
        var a = list[i];
        if (!isAngleBetween(this._pointerAngle, a.start % 360, a.end % 360)) continue;
        if (this._currentIndex === i) break;

        this._currentIndex = i;
        if (!this._isInitialising) {
          this.raiseEvent_onCurrentIndexChange();
        }
        break;
      }
    }

    getItemAngles(initialRotation) {
      var rot = initialRotation === undefined ? 0 : initialRotation;
      var weightSum = 0;
      var i;
      for (i = 0; i < this.items.length; i += 1) {
        weightSum += this.items[i].weight;
      }

      if (this._items.length === 0 || weightSum <= 0) {
        return [];
      }

      var weightedItemAngle = 360 / weightSum;
      var itemAngle;
      var lastItemAngle = rot;
      var angles = [];

      for (i = 0; i < this._items.length; i += 1) {
        itemAngle = this._items[i].weight * weightedItemAngle;
        angles.push({
          start: lastItemAngle,
          end: lastItemAngle + itemAngle
        });
        lastItemAngle += itemAngle;
      }

      if (this._items.length > 1) {
        angles[angles.length - 1].end = angles[0].start + 360;
      }

      return angles;
    }

    refresh() {
      if (this._frameRequestId === null) {
        var self = this;
        var win = getWindow();
        if (win && typeof win.requestAnimationFrame === 'function') {
          this._frameRequestId = win.requestAnimationFrame(function () {
            self.draw(getNow());
          });
        } else {
          this._frameRequestId = setTimeout(function () {
            self.draw(getNow());
          }, 16);
        }
      }
    }

    limitSpeed(speed, max) {
      var s = speed === undefined ? 0 : speed;
      var m = max === undefined ? 0 : max;
      var newSpeed = Math.min(s, m);
      return Math.max(newSpeed, -m);
    }

    beginSpin(speed, spinMethod) {
      var sp = speed === undefined ? 0 : speed;
      var method = spinMethod === undefined ? '' : spinMethod;

      this.stop();
      this._rotationSpeed = this.limitSpeed(sp, this._rotationSpeedMax);
      this._lastSpinFrameTime = getNow();
      this._rotationDirection = (this._rotationSpeed >= 0) ? 1 : -1;

      if (this._rotationSpeed !== 0) {
        this.raiseEvent_onSpin({
          method: method,
          rotationSpeed: this._rotationSpeed,
          rotationResistance: this._rotationResistance
        });
      }

      this.refresh();
    }

    refreshAriaLabel() {
      if (this.canvas === null) return;
      this.canvas.setAttribute('role', 'img');
      var wheelDescription = (this.items.length >= 2) ? (' The wheel has ' + this.items.length + ' slices.') : '';
      this.canvas.setAttribute('aria-label', 'An image of a spinning prize wheel.' + wheelDescription);
    }

    get borderColor() {
      return this._borderColor;
    }
    set borderColor(val) {
      this._borderColor = setProp({
        val: val,
        isValid: typeof val === 'string',
        errorMessage: 'Wheel.borderColor must be a string',
        defaultValue: Defaults.wheel.borderColor
      });
      this.refresh();
    }

    get borderWidth() {
      return this._borderWidth;
    }
    set borderWidth(val) {
      this._borderWidth = setProp({
        val: val,
        isValid: isNumber(val),
        errorMessage: 'Wheel.borderWidth must be a number',
        defaultValue: Defaults.wheel.borderWidth
      });
      this.refresh();
    }

    get debug() {
      return this._debug;
    }
    set debug(val) {
      this._debug = setProp({
        val: val,
        isValid: typeof val === 'boolean',
        errorMessage: 'Wheel.debug must be a boolean',
        defaultValue: Defaults.wheel.debug
      });
      this.refresh();
    }

    get image() {
      return this._image;
    }
    set image(val) {
      this._image = setProp({
        val: val,
        isValid: isHtmlImageElement(val) || val === null,
        errorMessage: 'Wheel.image must be a HTMLImageElement or null',
        defaultValue: Defaults.wheel.image
      });
      this.refresh();
    }

    get isInteractive() {
      return this._isInteractive;
    }
    set isInteractive(val) {
      this._isInteractive = setProp({
        val: val,
        isValid: typeof val === 'boolean',
        errorMessage: 'Wheel.isInteractive must be a boolean',
        defaultValue: Defaults.wheel.isInteractive
      });
      this.refreshCursor();
    }

    get itemBackgroundColors() {
      return this._itemBackgroundColors;
    }
    set itemBackgroundColors(val) {
      this._itemBackgroundColors = setProp({
        val: val,
        isValid: Array.isArray(val),
        errorMessage: 'Wheel.itemBackgroundColors must be an array',
        defaultValue: Defaults.wheel.itemBackgroundColors
      });
      this.refresh();
    }

    get itemLabelAlign() {
      return this._itemLabelAlign;
    }
    set itemLabelAlign(val) {
      this._itemLabelAlign = setProp({
        val: val,
        isValid: typeof val === 'string' && (val === AlignText.left || val === AlignText.right || val === AlignText.center),
        errorMessage: 'Wheel.itemLabelAlign must be one of Constants.AlignText',
        defaultValue: Defaults.wheel.itemLabelAlign
      });
      this.resize();
    }

    get itemLabelBaselineOffset() {
      return this._itemLabelBaselineOffset;
    }
    set itemLabelBaselineOffset(val) {
      this._itemLabelBaselineOffset = setProp({
        val: val,
        isValid: isNumber(val),
        errorMessage: 'Wheel.itemLabelBaselineOffset must be a number',
        defaultValue: Defaults.wheel.itemLabelBaselineOffset
      });
      this.resize();
    }

    get itemLabelColors() {
      return this._itemLabelColors;
    }
    set itemLabelColors(val) {
      this._itemLabelColors = setProp({
        val: val,
        isValid: Array.isArray(val),
        errorMessage: 'Wheel.itemLabelColors must be an array',
        defaultValue: Defaults.wheel.itemLabelColors
      });
      this.refresh();
    }

    get itemLabelFont() {
      return this._itemLabelFont;
    }
    set itemLabelFont(val) {
      this._itemLabelFont = setProp({
        val: val,
        isValid: typeof val === 'string',
        errorMessage: 'Wheel.itemLabelFont must be a string',
        defaultValue: Defaults.wheel.itemLabelFont
      });
      this.resize();
    }

    get itemLabelFontSizeMax() {
      return this._itemLabelFontSizeMax;
    }
    set itemLabelFontSizeMax(val) {
      this._itemLabelFontSizeMax = setProp({
        val: val,
        isValid: isNumber(val),
        errorMessage: 'Wheel.itemLabelFontSizeMax must be a number',
        defaultValue: Defaults.wheel.itemLabelFontSizeMax
      });
      this.resize();
    }

    get itemLabelRadius() {
      return this._itemLabelRadius;
    }
    set itemLabelRadius(val) {
      this._itemLabelRadius = setProp({
        val: val,
        isValid: isNumber(val),
        errorMessage: 'Wheel.itemLabelRadius must be a number',
        defaultValue: Defaults.wheel.itemLabelRadius
      });
      this.resize();
    }

    get itemLabelRadiusMax() {
      return this._itemLabelRadiusMax;
    }
    set itemLabelRadiusMax(val) {
      this._itemLabelRadiusMax = setProp({
        val: val,
        isValid: isNumber(val),
        errorMessage: 'Wheel.itemLabelRadiusMax must be a number',
        defaultValue: Defaults.wheel.itemLabelRadiusMax
      });
      this.resize();
    }

    get itemLabelRotation() {
      return this._itemLabelRotation;
    }
    set itemLabelRotation(val) {
      this._itemLabelRotation = setProp({
        val: val,
        isValid: isNumber(val),
        errorMessage: 'Wheel.itemLabelRotation must be a number',
        defaultValue: Defaults.wheel.itemLabelRotation
      });
      this.refresh();
    }

    get itemLabelStrokeColor() {
      return this._itemLabelStrokeColor;
    }
    set itemLabelStrokeColor(val) {
      this._itemLabelStrokeColor = setProp({
        val: val,
        isValid: typeof val === 'string',
        errorMessage: 'Wheel.itemLabelStrokeColor must be a string',
        defaultValue: Defaults.wheel.itemLabelStrokeColor
      });
      this.refresh();
    }

    get itemLabelStrokeWidth() {
      return this._itemLabelStrokeWidth;
    }
    set itemLabelStrokeWidth(val) {
      this._itemLabelStrokeWidth = setProp({
        val: val,
        isValid: isNumber(val),
        errorMessage: 'Wheel.itemLabelStrokeWidth must be a number',
        defaultValue: Defaults.wheel.itemLabelStrokeWidth
      });
      this.refresh();
    }

    get items() {
      return this._items;
    }
    set items(val) {
      var self = this;
      this._items = setProp({
        val: val,
        isValid: Array.isArray(val),
        errorMessage: 'Wheel.items must be an array of Items',
        defaultValue: Defaults.wheel.items,
        action: function () {
          var v = [];
          var i;
          for (i = 0; i < val.length; i += 1) {
            v.push(new Item(self, val[i]));
          }
          return v;
        }
      });

      this.refreshAriaLabel();
      this.refreshCurrentIndex(this.getItemAngles(this._rotation));
      this.resize();
    }

    get lineColor() {
      return this._lineColor;
    }
    set lineColor(val) {
      this._lineColor = setProp({
        val: val,
        isValid: typeof val === 'string',
        errorMessage: 'Wheel.lineColor must be a string',
        defaultValue: Defaults.wheel.lineColor
      });
      this.refresh();
    }

    get lineWidth() {
      return this._lineWidth;
    }
    set lineWidth(val) {
      this._lineWidth = setProp({
        val: val,
        isValid: isNumber(val),
        errorMessage: 'Wheel.lineWidth must be a number',
        defaultValue: Defaults.wheel.lineWidth
      });
      this.refresh();
    }

    get offset() {
      return this._offset;
    }
    set offset(val) {
      this._offset = setProp({
        val: val,
        isValid: isObject(val),
        errorMessage: 'Wheel.offset must be an object',
        defaultValue: Defaults.wheel.offset
      });
      this.resize();
    }

    get onCurrentIndexChange() {
      return this._onCurrentIndexChange;
    }
    set onCurrentIndexChange(val) {
      this._onCurrentIndexChange = setProp({
        val: val,
        isValid: typeof val === 'function' || val === null,
        errorMessage: 'Wheel.onCurrentIndexChange must be a function or null',
        defaultValue: Defaults.wheel.onCurrentIndexChange
      });
    }

    get onRest() {
      return this._onRest;
    }
    set onRest(val) {
      this._onRest = setProp({
        val: val,
        isValid: typeof val === 'function' || val === null,
        errorMessage: 'Wheel.onRest must be a function or null',
        defaultValue: Defaults.wheel.onRest
      });
    }

    get onSpin() {
      return this._onSpin;
    }
    set onSpin(val) {
      this._onSpin = setProp({
        val: val,
        isValid: typeof val === 'function' || val === null,
        errorMessage: 'Wheel.onSpin must be a function or null',
        defaultValue: Defaults.wheel.onSpin
      });
    }

    get overlayImage() {
      return this._overlayImage;
    }
    set overlayImage(val) {
      this._overlayImage = setProp({
        val: val,
        isValid: isHtmlImageElement(val) || val === null,
        errorMessage: 'Wheel.overlayImage must be a HTMLImageElement or null',
        defaultValue: Defaults.wheel.overlayImage
      });
      this.refresh();
    }

    get pixelRatio() {
      return this._pixelRatio;
    }
    set pixelRatio(val) {
      this._pixelRatio = setProp({
        val: val,
        isValid: isNumber(val),
        errorMessage: 'Wheel.pixelRatio must be a number',
        defaultValue: Defaults.wheel.pixelRatio
      });
      this._dragEvents = [];
      this.resize();
    }

    get pointerAngle() {
      return this._pointerAngle;
    }
    set pointerAngle(val) {
      this._pointerAngle = setProp({
        val: val,
        isValid: isNumber(val) && val >= 0,
        errorMessage: 'Wheel.pointerAngle must be a number between 0 and 360',
        defaultValue: Defaults.wheel.pointerAngle,
        action: function () { return val % 360; }
      });
      if (this.debug) {
        this.refresh();
      }
    }

    get radius() {
      return this._radius;
    }
    set radius(val) {
      this._radius = setProp({
        val: val,
        isValid: isNumber(val),
        errorMessage: 'Wheel.radius must be a number',
        defaultValue: Defaults.wheel.radius
      });
      this.resize();
    }

    get rotation() {
      return this._rotation;
    }
    set rotation(val) {
      this._rotation = setProp({
        val: val,
        isValid: isNumber(val),
        errorMessage: 'Wheel.rotation must be a number',
        defaultValue: Defaults.wheel.rotation
      });
      this.refreshCurrentIndex(this.getItemAngles(this._rotation));
      this.refresh();
    }

    get rotationResistance() {
      return this._rotationResistance;
    }
    set rotationResistance(val) {
      this._rotationResistance = setProp({
        val: val,
        isValid: isNumber(val),
        errorMessage: 'Wheel.rotationResistance must be a number',
        defaultValue: Defaults.wheel.rotationResistance
      });
    }

    get rotationSpeed() {
      return this._rotationSpeed;
    }

    get rotationSpeedMax() {
      return this._rotationSpeedMax;
    }
    set rotationSpeedMax(val) {
      this._rotationSpeedMax = setProp({
        val: val,
        isValid: isNumber(val) && val >= 0,
        errorMessage: 'Wheel.rotationSpeedMax must be a number >= 0',
        defaultValue: Defaults.wheel.rotationSpeedMax
      });
    }

    dragStart(point) {
      if (this.canvas === null) return;

      var p = translateXYToElement(point || { x: 0, y: 0 }, this.canvas, this.getActualPixelRatio());

      this.isDragging = true;
      this.stop();

      this._dragEvents = [{
        distance: 0,
        x: p.x,
        y: p.y,
        now: getNow()
      }];

      this.refreshCursor();
    }

    dragMove(point) {
      if (this.canvas === null || !this._dragEvents || !this._dragEvents.length) return;

      var p = translateXYToElement(point || { x: 0, y: 0 }, this.canvas, this.getActualPixelRatio());
      var a = this.getAngleFromCenter(p);

      var lastDragPoint = this._dragEvents[0];
      var lastAngle = this.getAngleFromCenter(lastDragPoint);
      var angleSinceLastMove = diffAngle(lastAngle, a);

      this._dragEvents.unshift({
        distance: angleSinceLastMove,
        x: p.x,
        y: p.y,
        now: getNow()
      });

      if (this.debug && this._dragEvents.length >= 40) {
        this._dragEvents.pop();
      }

      this.rotation += angleSinceLastMove;
    }

    dragEnd() {
      this.isDragging = false;

      var dragDistance = 0;
      var now = getNow();
      var eventsList = this._dragEvents || [];
      var i;

      for (i = 0; i < eventsList.length; i += 1) {
        var evt = eventsList[i];
        if (!this.isDragEventTooOld(now, evt)) {
          dragDistance += evt.distance;
          continue;
        }
        eventsList.length = i;
        if (this.debug) {
          this.refresh();
        }
        break;
      }

      this.refreshCursor();

      if (dragDistance === 0) return;

      this.beginSpin(dragDistance * (1000 / dragCapturePeriod), 'interact');
    }

    isDragEventTooOld(now, event) {
      var t = now === undefined ? 0 : now;
      var e = event || {};
      return (t - e.now) > dragCapturePeriod;
    }

    raiseEvent_onCurrentIndexChange(data) {
      if (typeof this.onCurrentIndexChange !== 'function') return;
      var payload = Object.assign({
        type: 'currentIndexChange',
        currentIndex: this._currentIndex
      }, data || {});
      this.onCurrentIndexChange(payload);
    }

    raiseEvent_onRest(data) {
      if (typeof this.onRest !== 'function') return;
      var payload = Object.assign({
        type: 'rest',
        currentIndex: this._currentIndex,
        rotation: this._rotation
      }, data || {});
      this.onRest(payload);
    }

    raiseEvent_onSpin(data) {
      if (typeof this.onSpin !== 'function') return;
      var payload = Object.assign({
        type: 'spin'
      }, data || {});
      this.onSpin(payload);
    }
  }

  var api = {
    Wheel: Wheel,
    easing: easing,
    AlignText: AlignText
  };

  if (root) {
    root.SpinWheelCore = api;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : null));
