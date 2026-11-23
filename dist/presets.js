(function (root) {
  'use strict';

  var MIN_ITEMS = 2;
  var MAX_ITEMS = 16;
  var MIN_WEIGHT = 1;
  var MAX_WEIGHT = 5;
  var MAX_LABEL_LENGTH = 24;
  var DEFAULT_PRESET_ID = 'eat';
  var DEFAULT_PALETTE_ID = 'dopamine';

  var PALETTES = [
    {
      id: 'dopamine',
      name: '奶油多巴胺',
      colors: [
        '#F4A293', // 柔和珊瑚
        '#FAD5AE', // 杏桃奶油
        '#B9D2BE', // 鼠尾草绿
        '#A9C6DC', // 雾霾浅蓝
        '#F5E3A8', // 黄油米
        '#CFC2E3'  // 淡香芋
      ],
      labelColor: '#23201D',
      borderColor: '#E5DDD0',
      lineColor: '#FFFDF8',
      accent: '#E85D4A'
    },
    {
      id: 'morandi',
      name: '莫兰迪美术馆',
      colors: [
        '#D89C8A', // 陶土
        '#E2D6C3', // 燕麦
        '#A7BFB2', // 桉树青
        '#9FB2C4', // 雾灰蓝
        '#CFA6AB', // 干枯玫瑰
        '#EDE5D6'  // 亚麻米
      ],
      labelColor: '#262320',
      borderColor: '#D6CDC0',
      lineColor: '#FAF7F2',
      accent: '#B86B5A'
    },
    {
      id: 'obsidian',
      name: '黑金仪式感',
      colors: [
        '#232329', // 曜石炭
        '#7D5B3B', // 古铜
        '#8E7659', // 暖沙
        '#733039', // 酒红
        '#9E7F47', // 香槟金
        '#393B42'  // 深岩灰
      ],
      labelColor: '#FAF4E8',
      borderColor: '#C9A96E',
      lineColor: '#D6B77C',
      accent: '#D8B36A'
    },
    {
      id: 'matcha',
      name: '春日抹茶',
      colors: [
        '#9EC28D', // 抹茶绿
        '#F7F2E4', // 奶霜白
        '#F3DC86', // 柚子黄
        '#A9DAD0', // 薄荷青
        '#F6BBAE', // 蜜桃粉
        '#D8BC9B'  // 暖木色
      ],
      labelColor: '#232B21',
      borderColor: '#D2DEC8',
      lineColor: '#FCFBF7',
      accent: '#5D8C52'
    }
  ];

  var PRESETS = [
    {
      id: 'eat',
      name: '今天吃什么',
      tag: '干饭救星',
      subtitle: '告别选择困难，这一口直接冲',
      paletteId: 'dopamine',
      items: [
        { label: '麻辣烫', weight: 1 },
        { label: '烤肉自助', weight: 1 },
        { label: '减脂轻食', weight: 1 },
        { label: '日式拉面', weight: 1 },
        { label: '火锅约起来', weight: 1 },
        { label: '猪脚饭', weight: 1 },
        { label: '韩式炸鸡', weight: 1 },
        { label: '自己做一顿', weight: 1 }
      ]
    },
    {
      id: 'drink',
      name: '续命喝什么',
      tag: '早C晚甜',
      subtitle: '今日续命饮品，交给转盘拍板',
      paletteId: 'matcha',
      items: [
        { label: '生椰拿铁', weight: 1 },
        { label: '鲜奶茶少糖', weight: 1 },
        { label: '多肉葡萄', weight: 1 },
        { label: '冰美式续命', weight: 1 },
        { label: '抹茶拿铁', weight: 1 },
        { label: '暴打柠檬茶', weight: 1 },
        { label: '热可可', weight: 1 },
        { label: '乖乖喝白水', weight: 1 }
      ]
    },
    {
      id: 'buy',
      name: '该不该买',
      tag: '理性种草',
      subtitle: '下单前转一转，专治犹豫纠结',
      paletteId: 'morandi',
      items: [
        { label: '立刻拿下', weight: 1 },
        { label: '放购物车3天', weight: 1 },
        { label: '找找平替', weight: 1 },
        { label: '省下这笔钱', weight: 1 },
        { label: '等大促再冲', weight: 1 },
        { label: '奖励努力的自己', weight: 1 }
      ]
    },
    {
      id: 'afterwork',
      name: '下班去干嘛',
      tag: '下班充能',
      subtitle: '收工后的黄金两小时，不虚度',
      paletteId: 'obsidian',
      items: [
        { label: '散步30分钟', weight: 1 },
        { label: '刷一部好剧', weight: 1 },
        { label: '健身房流汗', weight: 1 },
        { label: '泡脚早点睡', weight: 1 },
        { label: '约朋友小聚', weight: 1 },
        { label: '整理房间', weight: 1 },
        { label: '看20页书', weight: 1 },
        { label: '放空发呆', weight: 1 }
      ]
    },
    {
      id: 'weekend',
      name: '周末去哪玩',
      tag: '出门撒欢',
      subtitle: '把休息日过成喜欢的样子',
      paletteId: 'dopamine',
      items: [
        { label: 'Citywalk扫街', weight: 1 },
        { label: '宝藏咖啡馆', weight: 1 },
        { label: '公园草坪躺平', weight: 1 },
        { label: '逛美术馆看展', weight: 1 },
        { label: '周边短途自驾', weight: 1 },
        { label: '宅家追剧大扫除', weight: 1 },
        { label: '逛吃夜市', weight: 1 },
        { label: '出门拍写真', weight: 1 }
      ]
    },
    {
      id: 'party',
      name: '聚会大冒险',
      tag: '破冰神器',
      subtitle: '聚餐桌游热场，玩的就是心跳',
      paletteId: 'obsidian',
      items: [
        { label: '请喝奶茶', weight: 1 },
        { label: '相册第5张', weight: 1 },
        { label: '真心话一题', weight: 1 },
        { label: '发抽象动态', weight: 1 },
        { label: '模仿表情包', weight: 1 },
        { label: '免罚护身符', weight: 1 },
        { label: '清唱两句', weight: 1 },
        { label: '夸右边三句', weight: 1 }
      ]
    },
    {
      id: 'heal',
      name: '内耗救急指南',
      tag: '精神SPA',
      subtitle: '停下来深呼吸，先做一件轻盈小事',
      paletteId: 'morandi',
      items: [
        { label: '深呼吸十次', weight: 1 },
        { label: '远离手机1小时', weight: 1 },
        { label: '写3件小确幸', weight: 1 },
        { label: '出门晒太阳', weight: 1 },
        { label: '点杯热饮', weight: 1 },
        { label: '原谅今天的自己', weight: 1 },
        { label: '听循环老歌', weight: 1 },
        { label: '洗个热水澡', weight: 1 }
      ]
    },
    {
      id: 'yesno',
      name: '是非硬币局',
      tag: '一锤定音',
      subtitle: '别再反复横跳，听一听直觉的回响',
      paletteId: 'matcha',
      items: [
        { label: '冲就完了！', weight: 1 },
        { label: '算了下次吧', weight: 1 },
        { label: '再观望一下', weight: 1 },
        { label: '跟着直觉走', weight: 1 },
        { label: '果断拒绝', weight: 1 },
        { label: '马上行动', weight: 1 }
      ]
    }
  ];

  var FORTUNE_NOTES = {
    eat: [
      '胃已经在蠢蠢欲动了，这顿吃了才有力气发光',
      '别翻外卖软件了，今天就宠幸「{label}」吧',
      '干饭不犹豫，快乐翻倍涨，碳水和好心情都安排上',
      '宇宙食神亲自盖章：这一餐就选它，吃饱不内耗'
    ],
    drink: [
      '今天的精神电量，靠这一杯「{label}」一键满格',
      '打工人续命仪式感达成，喝完继续元气营业',
      '命运都在提醒你补水补能量，现在就去拿下这杯',
      '把烦恼吸进吸管里咕噜噜喝掉，快乐立刻到账'
    ],
    buy: [
      '转盘已经替你的钱包做完风控，照做不后悔',
      '喜欢是心动，克制是清醒，按签行事最稳妥',
      '消费决策终结者已盖章：给理性与快乐一个交代',
      '今天不纠结性价比，听完这签就彻底放下心头草'
    ],
    afterwork: [
      '把工作留在工位，今晚的时间完完全全属于你',
      '下班后的小事最治愈，哪怕只做这一件也很值得',
      '不需要完美日程，去「{label}」就是今晚最好的安排',
      '生活不是只有赶路，今晚给自己留一点温柔的留白'
    ],
    weekend: [
      '趁阳光和微风都在，这个周末就按这个剧本走',
      '好心情从走出门或真正放松开始，不许临时鸽自己',
      '今日出行灵感已送达，记得顺手拍几张开心碎片',
      '周末不讲究最优解，尽兴才是最顶级的日程表'
    ],
    party: [
      '全场目光已锁定！愿赌服输，气氛值直接拉满',
      '天选之子诞生，赶紧执行别让快乐冷场',
      '指针停在这里，说明今晚的精彩高光非你莫属',
      '友情小船乘风破浪的时刻到了，大家手机准备好'
    ],
    heal: [
      '世界太吵了，先从「{label}」开始把自己接回家',
      '允许自己慢半拍，情绪有起落本就是很正常的事',
      '不用急着想通所有事，先做完这件温柔的小事',
      '今天的你已经很努力了，请心安理得地善待自己'
    ],
    yesno: [
      '答案其实早就在你心里，转盘只是帮你推了一把',
      '别再十万次模拟未来了，就按这一签去落子吧',
      '一锤定音！选定之后就不再回头内耗，稳稳往前走',
      '命运偶尔很直白：此刻停在这里，就是最好的提示'
    ],
    _custom: [
      '指针划过千山万水，最后稳稳停在了「{label}」',
      '今日份天选答案已生成，祝你顺着心意痛快执行',
      '纠结到此为止！就决定是它了，祝你好运加倍',
      '生活偶尔需要一点随机的浪漫，这签刚好很合拍'
    ]
  };

  function isPlainObject(val) {
    return Boolean(val && typeof val === 'object' && !Array.isArray(val));
  }

  function trimText(val) {
    if (typeof val !== 'string') {
      return '';
    }
    return val.replace(/^\s+|\s+$/g, '');
  }

  function normalizeWeight(weight) {
    var num = typeof weight === 'number' ? weight : Number(weight);
    if (!Number.isFinite(num)) {
      return MIN_WEIGHT;
    }
    var rounded = Math.round(num);
    if (rounded < MIN_WEIGHT) {
      return MIN_WEIGHT;
    }
    if (rounded > MAX_WEIGHT) {
      return MAX_WEIGHT;
    }
    return rounded;
  }

  function clonePalette(palette) {
    if (!palette) {
      return null;
    }
    return {
      id: String(palette.id || DEFAULT_PALETTE_ID),
      name: String(palette.name || ''),
      colors: Array.isArray(palette.colors) ? palette.colors.slice() : [],
      labelColor: String(palette.labelColor || '#23201D'),
      borderColor: String(palette.borderColor || '#E5DDD0'),
      lineColor: String(palette.lineColor || '#FFFDF8'),
      accent: String(palette.accent || '#E85D4A')
    };
  }

  function cloneItems(items) {
    if (!Array.isArray(items)) {
      return [];
    }
    var copy = [];
    var i;
    for (i = 0; i < items.length; i += 1) {
      var item = items[i];
      if (typeof item === 'string') {
        copy.push({ label: item, weight: MIN_WEIGHT });
      } else if (isPlainObject(item)) {
        copy.push({
          label: typeof item.label === 'string' ? item.label : String(item.label || ''),
          weight: normalizeWeight(item.weight)
        });
      }
    }
    return copy;
  }

  function cloneScene(scene) {
    if (!isPlainObject(scene)) {
      return null;
    }
    return {
      id: typeof scene.id === 'string' && scene.id ? scene.id : 'custom',
      name: typeof scene.name === 'string' ? scene.name : '',
      tag: typeof scene.tag === 'string' ? scene.tag : '自定义',
      subtitle: typeof scene.subtitle === 'string' ? scene.subtitle : '',
      paletteId: resolvePaletteId(scene.paletteId),
      isCustom: Boolean(scene.isCustom),
      items: cloneItems(scene.items)
    };
  }

  function findPaletteRaw(id) {
    var i;
    for (i = 0; i < PALETTES.length; i += 1) {
      if (PALETTES[i].id === id) {
        return PALETTES[i];
      }
    }
    return null;
  }

  function resolvePaletteId(id) {
    return findPaletteRaw(id) ? id : DEFAULT_PALETTE_ID;
  }

  function getPalettes() {
    var list = [];
    var i;
    for (i = 0; i < PALETTES.length; i += 1) {
      list.push(clonePalette(PALETTES[i]));
    }
    return list;
  }

  function getPaletteById(id) {
    var found = findPaletteRaw(id) || findPaletteRaw(DEFAULT_PALETTE_ID) || PALETTES[0];
    return clonePalette(found);
  }

  function findPresetRaw(id) {
    var i;
    for (i = 0; i < PRESETS.length; i += 1) {
      if (PRESETS[i].id === id) {
        return PRESETS[i];
      }
    }
    return null;
  }

  function getPresets() {
    var list = [];
    var i;
    for (i = 0; i < PRESETS.length; i += 1) {
      var cloned = cloneScene(PRESETS[i]);
      cloned.isCustom = false;
      list.push(cloned);
    }
    return list;
  }

  function getPresetById(id) {
    var found = findPresetRaw(id);
    if (!found) {
      return null;
    }
    var cloned = cloneScene(found);
    cloned.isCustom = false;
    return cloned;
  }

  function getDefaultPreset() {
    return getPresetById(DEFAULT_PRESET_ID) || cloneScene(PRESETS[0]);
  }

  function validateItems(items) {
    var errors = [];
    var cleanItems = [];

    if (!Array.isArray(items)) {
      errors.push('选项列表格式不正确');
      return { valid: false, errors: errors, items: cleanItems };
    }

    var i;
    for (i = 0; i < items.length; i += 1) {
      var raw = items[i];
      var rawLabel = '';
      var rawWeight = MIN_WEIGHT;

      if (typeof raw === 'string') {
        rawLabel = raw;
      } else if (isPlainObject(raw)) {
        rawLabel = typeof raw.label === 'string' ? raw.label : String(raw.label || '');
        rawWeight = raw.weight;
      } else {
        errors.push('第 ' + (i + 1) + ' 项格式无效');
        continue;
      }

      var label = trimText(rawLabel);
      if (!label) {
        errors.push('第 ' + (i + 1) + ' 项名称不能为空');
        continue;
      }

      if (label.length > MAX_LABEL_LENGTH) {
        label = label.slice(0, MAX_LABEL_LENGTH);
      }

      var numWeight = typeof rawWeight === 'number' ? rawWeight : Number(rawWeight);
      if (rawWeight !== undefined && rawWeight !== null && !Number.isFinite(numWeight)) {
        errors.push('「' + label + '」权重必须是数字');
      } else if (Number.isFinite(numWeight) && (numWeight < MIN_WEIGHT || numWeight > MAX_WEIGHT)) {
        errors.push('「' + label + '」权重需在 ' + MIN_WEIGHT + ' 到 ' + MAX_WEIGHT + ' 之间');
      }

      cleanItems.push({
        label: label,
        weight: normalizeWeight(rawWeight)
      });
    }

    if (cleanItems.length < MIN_ITEMS) {
      errors.push('至少需要保留 ' + MIN_ITEMS + ' 个有效选项');
    } else if (cleanItems.length > MAX_ITEMS) {
      errors.push('最多支持 ' + MAX_ITEMS + ' 个选项');
      cleanItems = cleanItems.slice(0, MAX_ITEMS);
    }

    return {
      valid: errors.length === 0,
      errors: errors,
      items: cleanItems
    };
  }

  function validateScene(scene) {
    var errors = [];
    if (!isPlainObject(scene)) {
      return {
        valid: false,
        errors: ['场景数据无效'],
        scene: getDefaultPreset()
      };
    }

    var name = trimText(typeof scene.name === 'string' ? scene.name : '');
    if (!name) {
      errors.push('场景标题不能为空');
    } else if (name.length > 18) {
      name = name.slice(0, 18);
    }

    var itemCheck = validateItems(scene.items);
    for (var i = 0; i < itemCheck.errors.length; i += 1) {
      errors.push(itemCheck.errors[i]);
    }

    var normalized = {
      id: typeof scene.id === 'string' && scene.id ? scene.id : 'custom_' + Date.now(),
      name: name || '自定义决定',
      tag: trimText(typeof scene.tag === 'string' ? scene.tag : '') || (scene.isCustom ? '专属定制' : '每日决策'),
      subtitle: trimText(typeof scene.subtitle === 'string' ? scene.subtitle : '') || '写下你纠结的选项，转一下见分晓',
      paletteId: resolvePaletteId(scene.paletteId),
      isCustom: Boolean(scene.isCustom),
      items: itemCheck.items
    };

    return {
      valid: errors.length === 0,
      errors: errors,
      scene: normalized
    };
  }

  function normalizeScene(scene) {
    var checked = validateScene(scene);
    if (checked.scene.items.length < MIN_ITEMS) {
      var fallback = getDefaultPreset();
      checked.scene.items = fallback.items.slice(0, MIN_ITEMS);
    }
    return checked.scene;
  }

  function createCustomScene(options) {
    var opts = isPlainObject(options) ? options : {};
    var id = typeof opts.id === 'string' && opts.id ? opts.id : 'custom_' + Date.now();
    var baseItems = Array.isArray(opts.items) && opts.items.length >= MIN_ITEMS
      ? opts.items
      : [
          { label: '选项 A', weight: 1 },
          { label: '选项 B', weight: 1 },
          { label: '选项 C', weight: 1 }
        ];

    return normalizeScene({
      id: id,
      name: opts.name || '我的专属转盘',
      tag: opts.tag || '专属定制',
      subtitle: opts.subtitle || '属于你的选择池，随时增删和调整权重',
      paletteId: resolvePaletteId(opts.paletteId),
      isCustom: true,
      items: baseItems
    });
  }

  function buildWheelItems(items, paletteId, excludedIndicesOrLabels) {
    var palette = getPaletteById(paletteId);
    var colors = palette.colors && palette.colors.length ? palette.colors : ['#F4A293', '#FAD5AE'];
    var list = Array.isArray(items) ? items : [];
    var excluded = Array.isArray(excludedIndicesOrLabels) ? excludedIndicesOrLabels : [];
    var result = [];
    var i;

    for (i = 0; i < list.length; i += 1) {
      var entry = list[i];
      if (!entry) {
        continue;
      }
      var label = typeof entry === 'string' ? trimText(entry) : trimText(entry.label);
      if (!label) {
        continue;
      }
      if (excluded.indexOf(i) !== -1 || excluded.indexOf(label) !== -1) {
        continue;
      }

      var weight = typeof entry === 'string' ? MIN_WEIGHT : normalizeWeight(entry.weight);
      result.push({
        label: label,
        weight: weight,
        backgroundColor: colors[result.length % colors.length],
        labelColor: palette.labelColor,
        sourceIndex: i
      });
    }

    return result;
  }

  function hashText(str) {
    var hash = 0;
    var i;
    for (i = 0; i < str.length; i += 1) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  function generateFortuneNote(sceneId, itemLabel, seed) {
    var key = typeof sceneId === 'string' && FORTUNE_NOTES[sceneId] ? sceneId : '_custom';
    var pool = FORTUNE_NOTES[key] || FORTUNE_NOTES._custom;
    var label = trimText(typeof itemLabel === 'string' ? itemLabel : '') || '这一项';
    var idx;

    if (typeof seed === 'number' && Number.isFinite(seed)) {
      idx = Math.abs(Math.floor(seed)) % pool.length;
    } else {
      var salt = Math.floor(Math.random() * pool.length);
      idx = (hashText(key + '|' + label) + salt) % pool.length;
    }

    var template = pool[idx];
    return template.split('{label}').join(label);
  }

  var api = {
    MIN_ITEMS: MIN_ITEMS,
    MAX_ITEMS: MAX_ITEMS,
    MIN_WEIGHT: MIN_WEIGHT,
    MAX_WEIGHT: MAX_WEIGHT,
    MAX_LABEL_LENGTH: MAX_LABEL_LENGTH,
    DEFAULT_PRESET_ID: DEFAULT_PRESET_ID,
    DEFAULT_PALETTE_ID: DEFAULT_PALETTE_ID,
    getPresets: getPresets,
    getPresetById: getPresetById,
    getDefaultPreset: getDefaultPreset,
    getPalettes: getPalettes,
    getPaletteById: getPaletteById,
    cloneScene: cloneScene,
    cloneItems: cloneItems,
    createCustomScene: createCustomScene,
    normalizeWeight: normalizeWeight,
    validateItems: validateItems,
    validateScene: validateScene,
    normalizeScene: normalizeScene,
    buildWheelItems: buildWheelItems,
    generateFortuneNote: generateFortuneNote
  };

  if (root) {
    root.WheelPresets = api;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : null));
