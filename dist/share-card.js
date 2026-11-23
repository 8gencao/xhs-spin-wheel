(function (global) {
  'use strict';

  var CARD_WIDTH = 1080;
  var CARD_HEIGHT = 1440;
  var FONT_STACK = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", -apple-system, BlinkMacSystemFont, sans-serif';

  var BUILTIN_PALETTES = {
    dopamine: {
      id: 'dopamine',
      name: '奶油多巴胺',
      colors: ['#FF7A6B', '#FFB87A', '#8CC5A3', '#87B5DC', '#F5D67B', '#B8A4E3'],
      accent: '#E85D4A'
    },
    morandi: {
      id: 'morandi',
      name: '莫兰迪美术馆',
      colors: ['#C67D63', '#D9C7B2', '#7FA194', '#859EB0', '#C48F98', '#CFC3AF'],
      accent: '#B66B52'
    },
    obsidian: {
      id: 'obsidian',
      name: '黑金仪式感',
      colors: ['#2B2930', '#9A6F43', '#C9AE7E', '#8C3B42', '#D8B362', '#4B4B55'],
      accent: '#D4AF37'
    },
    matcha: {
      id: 'matcha',
      name: '春日抹茶',
      colors: ['#6B9B68', '#EAE6D8', '#E9C963', '#7BB7AD', '#EC9E98', '#B89674'],
      accent: '#568854'
    }
  };

  var DEFAULT_FORTUNES = [
    '直觉替你按下了确认键，今天只管奔赴这场好心情。',
    '别再纠结了，宇宙已经把这一格的好运推到了指针下。',
    '少一分犹豫，多一分松弛，选到的就是当下的最佳答案。',
    '今日宜果断行动，把多余的心思留给值得期待的小事。',
    '念念不忘不如转盘一响，现在就出发吧。'
  ];

  function normalizeText(value, fallback) {
    if (typeof value !== 'string') {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return String(value);
      }
      return fallback;
    }
    var trimmed = value.replace(/\s+/g, ' ').trim();
    return trimmed ? trimmed : fallback;
  }

  function truncateChars(text, maxChars) {
    var chars = Array.from(String(text || ''));
    if (chars.length <= maxChars) {
      return chars.join('');
    }
    return chars.slice(0, Math.max(1, maxChars - 1)).join('') + '…';
  }

  function formatNowDateTime() {
    var now = new Date();
    var y = String(now.getFullYear());
    var m = String(now.getMonth() + 1).padStart(2, '0');
    var d = String(now.getDate()).padStart(2, '0');
    var hh = String(now.getHours()).padStart(2, '0');
    var mm = String(now.getMinutes()).padStart(2, '0');
    return y + '-' + m + '-' + d + ' ' + hh + ':' + mm;
  }

  function formatDecisionNo(rawNo) {
    if (typeof rawNo === 'number' && Number.isFinite(rawNo) && rawNo >= 0) {
      var num = Math.max(1, Math.floor(rawNo));
      return 'NO.' + String(num).padStart(3, '0');
    }
    if (typeof rawNo === 'string' && rawNo.trim()) {
      var trimmed = rawNo.trim();
      if (/^\d+$/.test(trimmed)) {
        return 'NO.' + String(Math.max(1, Number(trimmed))).padStart(3, '0');
      }
      return trimmed;
    }
    return 'NO.001';
  }

  function parseHexRgb(hex) {
    if (typeof hex !== 'string') {
      return null;
    }
    var clean = hex.trim();
    if (clean.charAt(0) === '#') {
      clean = clean.slice(1);
    }
    if (clean.length === 3 && /^[0-9a-fA-F]{3}$/.test(clean)) {
      clean = clean.charAt(0) + clean.charAt(0) +
        clean.charAt(1) + clean.charAt(1) +
        clean.charAt(2) + clean.charAt(2);
    }
    if (clean.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(clean)) {
      return null;
    }
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16)
    };
  }

  function rgbToRgba(rgb, alpha) {
    return 'rgba(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ', ' + alpha + ')';
  }

  function colorWithAlpha(color, alpha, fallbackRgb) {
    var rgb = parseHexRgb(color) || fallbackRgb;
    return rgbToRgba(rgb, alpha);
  }

  function getLuminance(rgb) {
    return (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  }

  function mixRgb(a, b, ratio) {
    var t = Math.max(0, Math.min(1, ratio));
    return {
      r: Math.round(a.r * (1 - t) + b.r * t),
      g: Math.round(a.g * (1 - t) + b.g * t),
      b: Math.round(a.b * (1 - t) + b.b * t)
    };
  }

  function rgbToHex(rgb) {
    function part(n) {
      return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    }
    return '#' + part(rgb.r) + part(rgb.g) + part(rgb.b);
  }

  function resolvePalette(input) {
    var paletteObj = (input.palette && typeof input.palette === 'object') ? input.palette : null;
    var paletteId = normalizeText(
      (paletteObj && paletteObj.id) || input.paletteId,
      ''
    ).toLowerCase();
    var preset = BUILTIN_PALETTES[paletteId] || BUILTIN_PALETTES.dopamine;

    var rawColors = null;
    if (Array.isArray(input.paletteColors) && input.paletteColors.length > 0) {
      rawColors = input.paletteColors;
    } else if (paletteObj && Array.isArray(paletteObj.colors) && paletteObj.colors.length > 0) {
      rawColors = paletteObj.colors;
    } else {
      rawColors = preset.colors;
    }

    var colors = [];
    for (var i = 0; i < rawColors.length; i += 1) {
      if (typeof rawColors[i] === 'string' && rawColors[i].trim()) {
        colors.push(rawColors[i].trim());
      }
    }
    if (colors.length === 0) {
      colors = BUILTIN_PALETTES.dopamine.colors.slice();
    }

    var rawAccent = normalizeText(
      input.accentColor || (paletteObj && paletteObj.accent) || preset.accent,
      preset.accent
    );

    return {
      id: paletteId || preset.id,
      name: normalizeText((paletteObj && paletteObj.name) || input.paletteName, preset.name),
      colors: colors,
      rawAccent: rawAccent
    };
  }

  function createThemeTokens(isLight, palette) {
    var rawRgb = parseHexRgb(palette.rawAccent) ||
      (isLight ? { r: 232, g: 93, b: 74 } : { r: 212, g: 175, b: 55 });
    var lum = getLuminance(rawRgb);

    var accentRgb = rawRgb;
    if (isLight && lum > 0.64) {
      accentRgb = mixRgb(rawRgb, { r: 120, g: 58, b: 36 }, 0.45);
    } else if (!isLight && lum < 0.34) {
      accentRgb = mixRgb(rawRgb, { r: 224, g: 186, b: 102 }, 0.6);
    }

    var accentHex = rgbToHex(accentRgb);
    var accentContrastText = getLuminance(accentRgb) > 0.62 ? '#1E1A16' : '#FFFFFF';
    var goldRgb = isLight ? { r: 176, g: 122, b: 52 } : { r: 218, g: 180, b: 98 };

    return {
      isLight: isLight,
      accentHex: accentHex,
      accentRgb: accentRgb,
      accentContrastText: accentContrastText,
      goldHex: rgbToHex(goldRgb),
      goldRgb: goldRgb,
      bgTop: isLight ? '#FAF7F1' : '#18171C',
      bgMid: isLight ? '#F4EFE4' : '#121116',
      bgBottom: isLight ? '#EDE5D6' : '#0A090D',
      cardBg: isLight ? '#FFFFFF' : '#1C1B21',
      cardMutedBg: isLight ? '#F8F4EC' : '#17161B',
      chipBg: isLight ? '#F3ECE0' : '#24222B',
      chipBorder: isLight ? 'rgba(130, 108, 82, 0.22)' : 'rgba(218, 180, 98, 0.24)',
      textPrimary: isLight ? '#1F1C18' : '#F6EFE2',
      textSecondary: isLight ? '#5C5246' : '#C9B99B',
      textMuted: isLight ? '#8A7E6E' : '#8E816B',
      frameOuter: isLight ? 'rgba(148, 118, 82, 0.22)' : 'rgba(218, 180, 98, 0.22)',
      frameInner: isLight ? 'rgba(148, 118, 82, 0.44)' : 'rgba(218, 180, 98, 0.46)',
      divider: isLight ? 'rgba(132, 106, 76, 0.20)' : 'rgba(218, 180, 98, 0.22)',
      sealColor: isLight ? '#C94435' : '#D95B4A'
    };
  }

  function normalizeCandidates(rawList, resultLabel) {
    var list = [];
    if (Array.isArray(rawList)) {
      for (var i = 0; i < rawList.length; i += 1) {
        var entry = rawList[i];
        var label = '';
        if (typeof entry === 'string') {
          label = entry;
        } else if (entry && typeof entry === 'object') {
          label = entry.label || entry.name || entry.text || '';
        }
        var clean = normalizeText(label, '');
        if (clean) {
          list.push(clean);
        }
      }
    }
    if (list.length === 0) {
      list.push(resultLabel);
    }
    return list;
  }

  function resolveWinnerIndex(candidates, resultLabel, explicitIndex) {
    if (
      typeof explicitIndex === 'number' &&
      Number.isInteger(explicitIndex) &&
      explicitIndex >= 0 &&
      explicitIndex < candidates.length
    ) {
      return explicitIndex;
    }
    for (var i = 0; i < candidates.length; i += 1) {
      if (candidates[i] === resultLabel) {
        return i;
      }
    }
    return 0;
  }

  function pickDefaultFortune(resultLabel) {
    var str = String(resultLabel || '');
    var hash = 0;
    for (var i = 0; i < str.length; i += 1) {
      hash = ((hash * 31) + str.charCodeAt(i)) % 997;
    }
    return DEFAULT_FORTUNES[hash % DEFAULT_FORTUNES.length];
  }

  function measureWidth(ctx, text) {
    if (!text) {
      return 0;
    }
    var m = ctx.measureText(text);
    if (m && typeof m.width === 'number' && Number.isFinite(m.width) && m.width > 0) {
      return m.width;
    }
    return text.length * 16;
  }

  function drawRoundedRectPath(ctx, x, y, width, height, radius) {
    var r = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + r);
    ctx.lineTo(x + width, y + height - r);
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    ctx.lineTo(x + r, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function tokenizeForWrap(text) {
    var tokens = [];
    var chars = Array.from(String(text || ''));
    var asciiBuffer = '';
    for (var i = 0; i < chars.length; i += 1) {
      var ch = chars[i];
      if (/^[A-Za-z0-9._+-]$/.test(ch)) {
        asciiBuffer += ch;
      } else {
        if (asciiBuffer) {
          tokens.push(asciiBuffer);
          asciiBuffer = '';
        }
        tokens.push(ch);
      }
    }
    if (asciiBuffer) {
      tokens.push(asciiBuffer);
    }
    return tokens;
  }

  function wrapTextLines(ctx, text, maxWidth) {
    var paragraphs = String(text || '').split(/\r?\n/);
    var allLines = [];
    for (var p = 0; p < paragraphs.length; p += 1) {
      var para = paragraphs[p].trim();
      if (!para) {
        continue;
      }
      var tokens = tokenizeForWrap(para);
      var line = '';
      for (var i = 0; i < tokens.length; i += 1) {
        var token = tokens[i];
        if (!line && token === ' ') {
          continue;
        }
        var candidate = line + token;
        if (measureWidth(ctx, candidate) <= maxWidth) {
          line = candidate;
        } else {
          if (line) {
            allLines.push(line.replace(/\s+$/, ''));
            line = '';
          }
          if (token === ' ') {
            continue;
          }
          if (measureWidth(ctx, token) <= maxWidth) {
            line = token;
          } else {
            var tokenChars = Array.from(token);
            for (var c = 0; c < tokenChars.length; c += 1) {
              var ch = tokenChars[c];
              if (line && measureWidth(ctx, line + ch) > maxWidth) {
                allLines.push(line);
                line = ch;
              } else {
                line += ch;
              }
            }
          }
        }
      }
      if (line) {
        allLines.push(line.replace(/\s+$/, ''));
      }
    }
    return allLines.length > 0 ? allLines : [''];
  }

  function layoutFittedText(ctx, text, maxWidth, maxHeight, fontSizes, lineHeightRatio, fontWeight) {
    var weight = fontWeight || '700';
    for (var i = 0; i < fontSizes.length; i += 1) {
      var size = fontSizes[i];
      ctx.font = weight + ' ' + size + 'px ' + FONT_STACK;
      var lines = wrapTextLines(ctx, text, maxWidth);
      var lineHeight = Math.round(size * lineHeightRatio);
      if (lines.length * lineHeight <= maxHeight) {
        return {
          fontSize: size,
          lineHeight: lineHeight,
          lines: lines
        };
      }
    }

    var fallbackSize = fontSizes[fontSizes.length - 1];
    ctx.font = weight + ' ' + fallbackSize + 'px ' + FONT_STACK;
    var fallbackLines = wrapTextLines(ctx, text, maxWidth);
    var fallbackLineHeight = Math.round(fallbackSize * lineHeightRatio);
    var maxLines = Math.max(1, Math.floor(maxHeight / fallbackLineHeight));
    if (fallbackLines.length > maxLines) {
      fallbackLines = fallbackLines.slice(0, maxLines);
      var lastIdx = fallbackLines.length - 1;
      var lastLine = fallbackLines[lastIdx];
      while (lastLine.length > 1 && measureWidth(ctx, lastLine + '…') > maxWidth) {
        lastLine = Array.from(lastLine).slice(0, -1).join('');
      }
      fallbackLines[lastIdx] = lastLine + '…';
    }
    return {
      fontSize: fallbackSize,
      lineHeight: fallbackLineHeight,
      lines: fallbackLines
    };
  }

  function fitSingleLineFont(ctx, text, maxWidth, startSize, minSize, weight) {
    var size = startSize;
    var fontWeight = weight || '600';
    while (size > minSize) {
      ctx.font = fontWeight + ' ' + size + 'px ' + FONT_STACK;
      if (measureWidth(ctx, text) <= maxWidth) {
        return size;
      }
      size -= 2;
    }
    ctx.font = fontWeight + ' ' + minSize + 'px ' + FONT_STACK;
    return minSize;
  }

  function drawDiamond(ctx, cx, cy, r, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawBackground(ctx, tokens) {
    var bgGrad = ctx.createLinearGradient(0, 0, 0, CARD_HEIGHT);
    bgGrad.addColorStop(0, tokens.bgTop);
    bgGrad.addColorStop(0.52, tokens.bgMid);
    bgGrad.addColorStop(1, tokens.bgBottom);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

    // Subtle radial spotlight behind central wheel
    var wheelAura = ctx.createRadialGradient(540, 414, 32, 540, 414, 420);
    wheelAura.addColorStop(0, colorWithAlpha(tokens.accentHex, tokens.isLight ? 0.14 : 0.22, tokens.accentRgb));
    wheelAura.addColorStop(0.55, rgbToRgba(tokens.goldRgb, tokens.isLight ? 0.07 : 0.1));
    wheelAura.addColorStop(1, rgbToRgba(tokens.goldRgb, 0));
    ctx.fillStyle = wheelAura;
    ctx.fillRect(0, 0, CARD_WIDTH, 920);

    // Lower soft ambient wash
    var lowerAura = ctx.createRadialGradient(540, 1180, 20, 540, 1180, 420);
    lowerAura.addColorStop(0, rgbToRgba(tokens.goldRgb, tokens.isLight ? 0.08 : 0.09));
    lowerAura.addColorStop(1, rgbToRgba(tokens.goldRgb, 0));
    ctx.fillStyle = lowerAura;
    ctx.fillRect(0, 800, CARD_WIDTH, 640);
  }

  function drawCornerBracket(ctx, x, y, dx, dy, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(x, y + dy * 34);
    ctx.lineTo(x, y);
    ctx.lineTo(x + dx * 34, y);
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x + dx * 14, y + dy * 14, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawEditorialFrame(ctx, tokens) {
    ctx.save();
    drawRoundedRectPath(ctx, 34, 34, CARD_WIDTH - 68, CARD_HEIGHT - 68, 28);
    ctx.strokeStyle = tokens.frameOuter;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    drawRoundedRectPath(ctx, 50, 50, CARD_WIDTH - 100, CARD_HEIGHT - 100, 20);
    ctx.strokeStyle = tokens.frameInner;
    ctx.lineWidth = 2;
    ctx.stroke();

    var bracketColor = tokens.isLight ? rgbToRgba(tokens.goldRgb, 0.72) : rgbToRgba(tokens.goldRgb, 0.85);
    drawCornerBracket(ctx, 50, 50, 1, 1, bracketColor);
    drawCornerBracket(ctx, CARD_WIDTH - 50, 50, -1, 1, bracketColor);
    drawCornerBracket(ctx, 50, CARD_HEIGHT - 50, 1, -1, bracketColor);
    drawCornerBracket(ctx, CARD_WIDTH - 50, CARD_HEIGHT - 50, -1, -1, bracketColor);

    drawDiamond(ctx, CARD_WIDTH / 2, 50, 6.5, bracketColor);
    drawDiamond(ctx, CARD_WIDTH / 2, CARD_HEIGHT - 50, 6.5, bracketColor);
    ctx.restore();
  }

  function drawHeader(ctx, meta, tokens, palette) {
    ctx.save();

    // Top-left scene pill
    var sceneMaxW = 580;
    var sceneSize = fitSingleLineFont(ctx, meta.sceneName, sceneMaxW - 72, 23, 17, '600');
    var sceneTextW = measureWidth(ctx, meta.sceneName);
    var scenePillW = Math.min(sceneMaxW, Math.max(176, sceneTextW + 72));
    var pillY = 86;
    var pillH = 46;
    var scenePillX = 88;

    drawRoundedRectPath(ctx, scenePillX, pillY, scenePillW, pillH, 23);
    ctx.fillStyle = colorWithAlpha(tokens.accentHex, tokens.isLight ? 0.1 : 0.16, tokens.accentRgb);
    ctx.fill();
    ctx.strokeStyle = colorWithAlpha(tokens.accentHex, tokens.isLight ? 0.34 : 0.44, tokens.accentRgb);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Colored dot inside scene pill
    ctx.beginPath();
    ctx.arc(scenePillX + 24, pillY + pillH / 2, 6, 0, Math.PI * 2);
    ctx.fillStyle = tokens.accentHex;
    ctx.fill();

    ctx.font = '600 ' + sceneSize + 'px ' + FONT_STACK;
    ctx.fillStyle = tokens.textPrimary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(truncateChars(meta.sceneName, 22), scenePillX + 42, pillY + pillH / 2 + 1);

    // Top-right decision serial badge
    var serialText = meta.decisionNo;
    var serialSize = fitSingleLineFont(ctx, serialText, 240, 22, 16, '700');
    var serialW = Math.min(280, Math.max(144, measureWidth(ctx, serialText) + 44));
    var serialX = CARD_WIDTH - 88 - serialW;

    drawRoundedRectPath(ctx, serialX, pillY, serialW, pillH, 23);
    ctx.fillStyle = tokens.isLight ? 'rgba(130, 102, 68, 0.08)' : 'rgba(218, 180, 98, 0.12)';
    ctx.fill();
    ctx.strokeStyle = tokens.frameInner;
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.font = '700 ' + serialSize + 'px ' + FONT_STACK;
    ctx.fillStyle = tokens.isLight ? tokens.textSecondary : tokens.goldHex;
    ctx.textAlign = 'center';
    ctx.fillText(serialText, serialX + serialW / 2, pillY + pillH / 2 + 1);

    // Main title
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 52px ' + FONT_STACK;
    if (tokens.isLight) {
      ctx.fillStyle = tokens.textPrimary;
    } else {
      var titleGrad = ctx.createLinearGradient(320, 152, 760, 200);
      titleGrad.addColorStop(0, '#FCEBC2');
      titleGrad.addColorStop(0.5, '#E4BC66');
      titleGrad.addColorStop(1, '#C9983E');
      ctx.fillStyle = titleGrad;
    }
    ctx.fillText('今日天选决定签', CARD_WIDTH / 2, 174);

    // Date-time & palette tag strip with ornamental rules
    var subMeta = meta.dateText + '  ·  ' + (meta.sceneTag ? meta.sceneTag : palette.name);
    var subSize = fitSingleLineFont(ctx, subMeta, 540, 21, 16, '500');
    var subW = measureWidth(ctx, subMeta);
    var subHalf = subW / 2 + 24;
    var lineY = 224;

    ctx.strokeStyle = tokens.divider;
    ctx.lineWidth = 1.5;
    if (540 - subHalf > 110) {
      ctx.beginPath();
      ctx.moveTo(100, lineY);
      ctx.lineTo(540 - subHalf, lineY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(540 + subHalf, lineY);
      ctx.lineTo(CARD_WIDTH - 100, lineY);
      ctx.stroke();
    }

    ctx.font = '500 ' + subSize + 'px ' + FONT_STACK;
    ctx.fillStyle = tokens.textSecondary;
    ctx.fillText(subMeta, CARD_WIDTH / 2, lineY + 1);

    ctx.restore();
  }

  function drawMiniatureWheel(ctx, candidates, winnerIndex, palette, tokens) {
    var cx = CARD_WIDTH / 2;
    var cy = 414;
    var wheelR = 124;
    var bezelOuterR = 138;
    var sliceCount = Math.min(Math.max(candidates.length, 6), 16);
    var sliceAngle = (Math.PI * 2) / sliceCount;
    var activeIdx = winnerIndex % sliceCount;

    ctx.save();

    // Outer orbital ring & radial tick dots
    ctx.save();
    if (typeof ctx.setLineDash === 'function') {
      ctx.setLineDash([5, 10]);
    }
    ctx.beginPath();
    ctx.arc(cx, cy, 160, 0, Math.PI * 2);
    ctx.strokeStyle = colorWithAlpha(tokens.accentHex, tokens.isLight ? 0.25 : 0.32, tokens.accentRgb);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();

    for (var d = 0; d < 24; d += 1) {
      var dotAngle = (Math.PI * 2 * d) / 24 - Math.PI / 2;
      var dotR = d % 2 === 0 ? 3 : 1.7;
      var dx = cx + Math.cos(dotAngle) * 149;
      var dy = cy + Math.sin(dotAngle) * 149;
      ctx.beginPath();
      ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
      ctx.fillStyle = d === 0
        ? tokens.accentHex
        : (tokens.isLight ? 'rgba(130, 104, 72, 0.34)' : 'rgba(222, 184, 104, 0.42)');
      ctx.fill();
    }

    // Drop shadow behind wheel bezel
    ctx.save();
    ctx.shadowColor = tokens.isLight ? 'rgba(42, 30, 18, 0.16)' : 'rgba(0, 0, 0, 0.58)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.beginPath();
    ctx.arc(cx, cy, bezelOuterR, 0, Math.PI * 2);
    ctx.fillStyle = tokens.isLight ? '#E7DFD1' : '#26232B';
    ctx.fill();
    ctx.restore();

    // Metallic watch-bezel gradient
    var bezelGrad = ctx.createLinearGradient(cx - bezelOuterR, cy - bezelOuterR, cx + bezelOuterR, cy + bezelOuterR);
    if (tokens.isLight) {
      bezelGrad.addColorStop(0, '#FFFDF9');
      bezelGrad.addColorStop(0.45, '#DCD2C1');
      bezelGrad.addColorStop(1, '#B8AA95');
    } else {
      bezelGrad.addColorStop(0, '#F6DE9F');
      bezelGrad.addColorStop(0.48, '#A97E38');
      bezelGrad.addColorStop(1, '#E7C36E');
    }
    ctx.beginPath();
    ctx.arc(cx, cy, bezelOuterR, 0, Math.PI * 2);
    ctx.fillStyle = bezelGrad;
    ctx.fill();

    // Inner dark/light rim separator
    ctx.beginPath();
    ctx.arc(cx, cy, wheelR + 3, 0, Math.PI * 2);
    ctx.fillStyle = tokens.isLight ? '#FFFFFF' : '#141318';
    ctx.fill();

    // Slices positioned so activeIdx is centered at 12 o'clock (-Math.PI / 2)
    var baseOffset = -Math.PI / 2 - activeIdx * sliceAngle - sliceAngle / 2;
    for (var s = 0; s < sliceCount; s += 1) {
      var startA = baseOffset + s * sliceAngle;
      var endA = startA + sliceAngle;
      var sliceColor = palette.colors[s % palette.colors.length];

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, wheelR, startA, endA);
      ctx.closePath();
      ctx.fillStyle = sliceColor;
      ctx.fill();

      ctx.strokeStyle = tokens.isLight ? 'rgba(255, 255, 255, 0.85)' : 'rgba(18, 17, 22, 0.72)';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // Highlight the winning 12 o'clock wedge
      if (s === activeIdx) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, wheelR - 3, startA + 0.02, endA - 0.02);
        ctx.closePath();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3.2;
        ctx.stroke();
        ctx.restore();
      }
    }

    // Subtle radial gloss overlay over wheel slices
    var gloss = ctx.createRadialGradient(cx - 28, cy - 34, 12, cx, cy, wheelR);
    gloss.addColorStop(0, 'rgba(255, 255, 255, 0.24)');
    gloss.addColorStop(0.55, 'rgba(255, 255, 255, 0.03)');
    gloss.addColorStop(1, 'rgba(0, 0, 0, 0.14)');
    ctx.beginPath();
    ctx.arc(cx, cy, wheelR, 0, Math.PI * 2);
    ctx.fillStyle = gloss;
    ctx.fill();

    // Inner geometric rosette ring
    ctx.beginPath();
    ctx.arc(cx, cy, 42, 0, Math.PI * 2);
    ctx.fillStyle = tokens.isLight ? 'rgba(255, 252, 246, 0.92)' : 'rgba(22, 20, 26, 0.92)';
    ctx.fill();
    ctx.strokeStyle = tokens.isLight ? 'rgba(180, 142, 92, 0.45)' : 'rgba(228, 192, 112, 0.6)';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Center hub jewel cap
    ctx.beginPath();
    ctx.arc(cx, cy, 24, 0, Math.PI * 2);
    ctx.fillStyle = tokens.accentHex;
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Crisp 4-point star emblem inside hub
    ctx.fillStyle = tokens.accentContrastText;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 11);
    ctx.quadraticCurveTo(cx + 2.2, cy - 2.2, cx + 11, cy);
    ctx.quadraticCurveTo(cx + 2.2, cy + 2.2, cx, cy + 11);
    ctx.quadraticCurveTo(cx - 2.2, cy + 2.2, cx - 11, cy);
    ctx.quadraticCurveTo(cx - 2.2, cy - 2.2, cx, cy - 11);
    ctx.closePath();
    ctx.fill();

    // 12 o'clock teardrop metallic pointer
    var tipY = cy - wheelR + 18;
    var topY = cy - bezelOuterR - 18;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.28)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;

    ctx.beginPath();
    ctx.moveTo(cx, tipY);
    ctx.bezierCurveTo(cx + 22, topY + 26, cx + 19, topY, cx, topY);
    ctx.bezierCurveTo(cx - 19, topY, cx - 22, topY + 26, cx, tipY);
    ctx.closePath();

    var pointerGrad = ctx.createLinearGradient(cx, topY, cx, tipY);
    pointerGrad.addColorStop(0, tokens.isLight ? '#FF8370' : '#FCE5A6');
    pointerGrad.addColorStop(1, tokens.accentHex);
    ctx.fillStyle = pointerGrad;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Pointer pivot dot
    ctx.beginPath();
    ctx.arc(cx, topY + 13, 4.2, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  function drawWinnerCard(ctx, resultLabel, tokens) {
    var cardX = 88;
    var cardY = 594;
    var cardW = CARD_WIDTH - 176;
    var cardH = 276;

    ctx.save();
    ctx.shadowColor = tokens.isLight ? 'rgba(42, 32, 20, 0.09)' : 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 10;
    drawRoundedRectPath(ctx, cardX, cardY, cardW, cardH, 28);
    ctx.fillStyle = tokens.cardBg;
    ctx.fill();
    ctx.restore();

    ctx.save();
    drawRoundedRectPath(ctx, cardX, cardY, cardW, cardH, 28);
    ctx.strokeStyle = colorWithAlpha(tokens.accentHex, tokens.isLight ? 0.34 : 0.45, tokens.accentRgb);
    ctx.lineWidth = 2;
    ctx.stroke();

    // Top straddling badge
    var badgeW = 280;
    var badgeH = 42;
    var badgeX = (CARD_WIDTH - badgeW) / 2;
    var badgeY = cardY - badgeH / 2;

    drawRoundedRectPath(ctx, badgeX, badgeY, badgeW, badgeH, 21);
    ctx.fillStyle = tokens.accentHex;
    ctx.fill();

    ctx.font = '700 20px ' + FONT_STACK;
    ctx.fillStyle = tokens.accentContrastText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✦  本 轮 天 选 决 定  ✦', CARD_WIDTH / 2, badgeY + badgeH / 2 + 1);

    // Subtle inner corner accents inside winner card
    ctx.strokeStyle = colorWithAlpha(tokens.accentHex, 0.22, tokens.accentRgb);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cardX + 34, cardY + 54);
    ctx.lineTo(cardX + 34, cardY + 34);
    ctx.lineTo(cardX + 54, cardY + 34);
    ctx.moveTo(cardX + cardW - 54, cardY + cardH - 34);
    ctx.lineTo(cardX + cardW - 34, cardY + cardH - 34);
    ctx.lineTo(cardX + cardW - 34, cardY + cardH - 54);
    ctx.stroke();

    // Dynamic auto-sized multi-line winner label
    var textMaxW = cardW - 96;
    var textMaxH = cardH - 82;
    var layout = layoutFittedText(
      ctx,
      resultLabel,
      textMaxW,
      textMaxH,
      [86, 76, 66, 56, 48, 40, 34, 28],
      1.24,
      '700'
    );

    ctx.font = '700 ' + layout.fontSize + 'px ' + FONT_STACK;
    ctx.fillStyle = tokens.textPrimary;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    var totalTextH = layout.lines.length * layout.lineHeight;
    var firstLineCenterY = cardY + 14 + (cardH - 14 - totalTextH) / 2 + layout.lineHeight / 2;
    for (var i = 0; i < layout.lines.length; i += 1) {
      ctx.fillText(layout.lines[i], CARD_WIDTH / 2, firstLineCenterY + i * layout.lineHeight);
    }

    ctx.restore();
  }

  function buildVisibleCandidateChips(candidates, winnerIndex) {
    var items = [];
    for (var i = 0; i < candidates.length; i += 1) {
      items.push({
        index: i,
        label: truncateChars(candidates[i], 10),
        isWinner: i === winnerIndex
      });
    }
    // Ensure winner appears early so it is never hidden behind "+N 项"
    if (winnerIndex > 5) {
      var winnerItem = items.splice(winnerIndex, 1)[0];
      items.unshift(winnerItem);
    }
    return items;
  }

  function drawCandidatePool(ctx, candidates, winnerIndex, excludedCount, tokens) {
    ctx.save();

    var headerY = 910;
    var poolLabel = '本轮候选池 · 共 ' + candidates.length + ' 项';
    if (excludedCount > 0) {
      poolLabel += '（已排除 ' + excludedCount + ' 项）';
    }

    ctx.font = '600 21px ' + FONT_STACK;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    var labelW = measureWidth(ctx, poolLabel);
    var gap = labelW / 2 + 20;

    ctx.strokeStyle = tokens.divider;
    ctx.lineWidth = 1.4;
    if (540 - gap > 100) {
      ctx.beginPath();
      ctx.moveTo(88, headerY);
      ctx.lineTo(540 - gap, headerY);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(540 + gap, headerY);
      ctx.lineTo(CARD_WIDTH - 88, headerY);
      ctx.stroke();
    }

    ctx.fillStyle = tokens.textMuted;
    ctx.fillText(poolLabel, CARD_WIDTH / 2, headerY + 1);

    // Compute centered 2-row chip layout
    var areaMaxW = CARD_WIDTH - 176;
    var chipH = 44;
    var chipGapX = 14;
    var chipGapY = 14;
    var chipFont = '600 20px ' + FONT_STACK;
    ctx.font = chipFont;

    var rawChips = buildVisibleCandidateChips(candidates, winnerIndex);
    var measured = [];
    for (var i = 0; i < rawChips.length; i += 1) {
      var displayText = (rawChips[i].isWinner ? '★ ' : '') + rawChips[i].label;
      var w = Math.min(280, Math.ceil(measureWidth(ctx, displayText)) + 40);
      measured.push({
        text: displayText,
        width: w,
        isWinner: rawChips[i].isWinner
      });
    }

    var rows = [[], []];
    var rowWidths = [0, 0];
    var overflowCount = 0;

    for (var idx = 0; idx < measured.length; idx += 1) {
      var chip = measured[idx];
      var placed = false;
      for (var r = 0; r < 2; r += 1) {
        var addedW = (rows[r].length > 0 ? chipGapX : 0) + chip.width;
        // Reserve room on row 2 for "+N 项" badge when more items follow
        var reserveBadge = (r === 1 && idx < measured.length - 1) ? 116 : 0;
        if (rowWidths[r] + addedW + reserveBadge <= areaMaxW) {
          rows[r].push(chip);
          rowWidths[r] += addedW;
          placed = true;
          break;
        }
      }
      if (!placed) {
        overflowCount = measured.length - idx;
        break;
      }
    }

    if (overflowCount > 0) {
      var moreText = '+' + overflowCount + ' 项';
      var moreW = Math.max(88, Math.ceil(measureWidth(ctx, moreText)) + 34);
      while (rows[1].length > 0 && rowWidths[1] + chipGapX + moreW > areaMaxW) {
        var popped = rows[1].pop();
        rowWidths[1] -= popped.width + (rows[1].length > 0 ? chipGapX : 0);
        overflowCount += 1;
        moreText = '+' + overflowCount + ' 项';
        moreW = Math.max(88, Math.ceil(measureWidth(ctx, moreText)) + 34);
      }
      rows[1].push({
        text: moreText,
        width: moreW,
        isWinner: false,
        isMore: true
      });
      rowWidths[1] += (rows[1].length > 1 ? chipGapX : 0) + moreW;
    }

    var activeRowCount = rows[1].length > 0 ? 2 : 1;
    var startY = activeRowCount === 1 ? 976 : 950;

    for (var rowIdx = 0; rowIdx < activeRowCount; rowIdx += 1) {
      var row = rows[rowIdx];
      var cursorX = (CARD_WIDTH - rowWidths[rowIdx]) / 2;
      var y = startY + rowIdx * (chipH + chipGapY);

      for (var c = 0; c < row.length; c += 1) {
        var item = row[c];
        drawRoundedRectPath(ctx, cursorX, y, item.width, chipH, 22);
        if (item.isWinner) {
          ctx.fillStyle = tokens.accentHex;
          ctx.fill();
        } else {
          ctx.fillStyle = tokens.chipBg;
          ctx.fill();
          ctx.strokeStyle = tokens.chipBorder;
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }

        ctx.font = chipFont;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = item.isWinner
          ? tokens.accentContrastText
          : (item.isMore ? tokens.textMuted : tokens.textSecondary);
        ctx.fillText(item.text, cursorX + item.width / 2, y + chipH / 2 + 1);

        cursorX += item.width + chipGapX;
      }
    }

    ctx.restore();
  }

  function drawFortunePlaque(ctx, fortuneText, tokens) {
    var boxX = 88;
    var boxY = 1106;
    var boxW = CARD_WIDTH - 176;
    var boxH = 138;

    ctx.save();
    drawRoundedRectPath(ctx, boxX, boxY, boxW, boxH, 24);
    ctx.fillStyle = tokens.cardMutedBg;
    ctx.fill();
    ctx.strokeStyle = tokens.divider;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Left accent quote bar
    drawRoundedRectPath(ctx, boxX + 26, boxY + 28, 6, boxH - 56, 3);
    ctx.fillStyle = tokens.accentHex;
    ctx.fill();

    // Decorative oversized quote glyph
    ctx.font = '700 54px ' + FONT_STACK;
    ctx.fillStyle = colorWithAlpha(tokens.accentHex, 0.24, tokens.accentRgb);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('“', boxX + 46, boxY + 14);

    // Fitted fortune quote text
    var quoteText = fortuneText;
    var layout = layoutFittedText(
      ctx,
      quoteText,
      boxW - 118,
      boxH - 36,
      [27, 24, 21, 18],
      1.36,
      '500'
    );

    ctx.font = '500 ' + layout.fontSize + 'px ' + FONT_STACK;
    ctx.fillStyle = tokens.textPrimary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    var totalH = layout.lines.length * layout.lineHeight;
    var startY = boxY + (boxH - totalH) / 2 + layout.lineHeight / 2;
    for (var i = 0; i < layout.lines.length; i += 1) {
      ctx.fillText(layout.lines[i], boxX + 74, startY + i * layout.lineHeight);
    }

    ctx.restore();
  }

  function drawFooterAndWatermark(ctx, tokens) {
    ctx.save();

    // Hairline divider
    ctx.strokeStyle = tokens.divider;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(88, 1274);
    ctx.lineTo(CARD_WIDTH - 88, 1274);
    ctx.stroke();

    // Magazine colophon tagline
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '500 20px ' + FONT_STACK;
    ctx.fillStyle = tokens.textMuted;
    ctx.fillText('决定大转盘  ·  让直觉替你做一次主', CARD_WIDTH / 2, 1312);

    // Mandatory personal watermark: made by 八根草
    var watermark = 'made by 八根草';
    ctx.font = '600 22px ' + FONT_STACK;
    var wmWidth = measureWidth(ctx, watermark);
    var wmHalf = wmWidth / 2 + 18;
    var wmY = 1352;

    ctx.strokeStyle = tokens.divider;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(CARD_WIDTH / 2 - wmHalf - 44, wmY);
    ctx.lineTo(CARD_WIDTH / 2 - wmHalf, wmY);
    ctx.moveTo(CARD_WIDTH / 2 + wmHalf, wmY);
    ctx.lineTo(CARD_WIDTH / 2 + wmHalf + 44, wmY);
    ctx.stroke();

    ctx.fillStyle = tokens.isLight ? tokens.textSecondary : tokens.goldHex;
    ctx.fillText(watermark, CARD_WIDTH / 2, wmY + 1);

    // Traditional vermilion editorial stamp at bottom-right
    var stampSize = 56;
    var stampX = CARD_WIDTH - 88 - stampSize;
    var stampY = 1300;

    drawRoundedRectPath(ctx, stampX, stampY, stampSize, stampSize, 10);
    ctx.fillStyle = colorWithAlpha(tokens.sealColor, tokens.isLight ? 0.08 : 0.14, { r: 201, g: 68, b: 53 });
    ctx.fill();
    ctx.strokeStyle = tokens.sealColor;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.font = '700 20px ' + FONT_STACK;
    ctx.fillStyle = tokens.sealColor;
    ctx.fillText('天', stampX + stampSize / 2, stampY + 18);
    ctx.fillText('选', stampX + stampSize / 2, stampY + 40);

    ctx.restore();
  }

  /**
   * Render a 1080x1440 (3:4) Xiaohongshu decision sign poster Canvas.
   * @param {object} options
   * @returns {HTMLCanvasElement}
   */
  function renderDecisionCard(options) {
    var input = (options && typeof options === 'object') ? options : {};
    var isLight = input.theme !== 'dark';
    var palette = resolvePalette(input);
    var tokens = createThemeTokens(isLight, palette);

    var resultLabel = normalizeText(
      input.resultLabel || input.result || input.winner || input.selectedLabel,
      '今天的好运气'
    );
    var sceneName = normalizeText(input.sceneName || input.sceneTitle, '今天吃什么');
    var sceneTag = normalizeText(input.sceneTag, '');
    var dateText = normalizeText(input.dateText, formatNowDateTime());
    var decisionNo = formatDecisionNo(
      input.decisionNo !== undefined
        ? input.decisionNo
        : (input.serialNo !== undefined ? input.serialNo : input.roundNo)
    );
    var candidates = normalizeCandidates(
      input.candidates || input.items || input.pool,
      resultLabel
    );
    var winnerIndex = resolveWinnerIndex(candidates, resultLabel, input.winnerIndex);
    var fortuneText = normalizeText(
      input.fortuneText || input.quote || input.blessing || input.fortune || input.comment,
      pickDefaultFortune(resultLabel)
    );
    var excludedCount = (typeof input.excludedCount === 'number' && Number.isFinite(input.excludedCount) && input.excludedCount > 0)
      ? Math.floor(input.excludedCount)
      : 0;

    var canvas = document.createElement('canvas');
    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;

    var ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('无法获取 Canvas 2D 上下文');
    }

    drawBackground(ctx, tokens);
    drawEditorialFrame(ctx, tokens);
    drawHeader(
      ctx,
      {
        sceneName: sceneName,
        sceneTag: sceneTag,
        dateText: dateText,
        decisionNo: decisionNo
      },
      tokens,
      palette
    );
    drawMiniatureWheel(ctx, candidates, winnerIndex, palette, tokens);
    drawWinnerCard(ctx, resultLabel, tokens);
    drawCandidatePool(ctx, candidates, winnerIndex, excludedCount, tokens);
    drawFortunePlaque(ctx, fortuneText, tokens);
    drawFooterAndWatermark(ctx, tokens);

    return canvas;
  }

  global.WheelShareCard = {
    CARD_WIDTH: CARD_WIDTH,
    CARD_HEIGHT: CARD_HEIGHT,
    renderDecisionCard: renderDecisionCard
  };
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : (typeof global !== 'undefined' ? global : {})));
