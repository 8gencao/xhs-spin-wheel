# 决定大转盘（小红书小工具版）

> 基于开源项目 [CrazyTim/spin-wheel](https://github.com/CrazyTim/spin-wheel) (v5.0.2, MIT License) 深度改造与移植的小红书离线 H5 小工具。
>
> **made by 八根草**

## 核心特性

- **8 套高频生活预设场景**：今天吃什么（默认）、续命喝什么、该不该买、下班去干嘛、周末去哪玩、聚会大冒险、内耗救急指南、是非硬币局，并支持新建/编辑/删除自定义转盘（2–16 项、1x–5x 权重）。
- **4 套杂志感转盘色板**：奶油多巴胺（`dopamine`）、莫兰迪美术馆（`morandi`）、黑金仪式感（`obsidian`）、春日抹茶（`matcha`）。
- **双主题一键切换**：晨雾暖白（默认 `#F7F5F0`）与暮夜黑金（`#121215`），同步维护 `color-scheme` 与无 JS 兜底媒体查询。
- **物理惯性拨盘与阻尼指针**：支持手指拨动惯性旋转、中心「转」/「开始决定」按钮、水滴形金属指针过线弹性偏转。
- **不放回排除模式**：支持开启自动排除已抽中项（保底保留 2 项）、结果弹窗单次剔除再转、一键复原候选池。
- **纯本地 Web Audio 合成音效**：机械棘轮（`ratchet`）、清脆木拨（`wood`）、静音（`mute`）三模式与中奖和弦，零外部音频文件。
- **小红书宿主端能力深度适配**：
  - 安全区与胶囊避让（`getWindowInfo` 9.49+ / `capsule` 9.55+）
  - 端内本地缓存（`getStorage` / `setStorage` 9.46+，容器外安全降级至 `localStorage`）
  - 指针过线短震动（`vibrateShort` 9.50+，40ms 节流保护）
  - 陀螺仪摇一摇开转（`startGyroscope` / `onGyroscopeChange` 9.50+，3 档灵敏度 + 后台自动暂停/前台恢复）
  - 3:4「今日天选决定签」Canvas 2D 海报（1080×1440，自适应浅/深主题与色板，含 `made by 八根草` 水印），支持保存相册（9.42+）、发笔记、评论区晒结果（9.49+）、分享工具卡（9.53+）。

## 目录结构

```text
spin-wheel-minitool/
├── LICENSE
├── README.md
└── dist/
    ├── index.html           # 离线包入口（静态首屏 + 经典 defer 脚本）
    ├── style.css            # Chrome 61 基线 + 渐进增强双主题样式
    ├── xhs-bridge.js        # 小红书端能力桥接（window.XhsBridge）
    ├── presets.js           # 8 套预设、4 套色板与校验（window.WheelPresets）
    ├── spin-wheel-core.js   # ES2017 转盘核心引擎（window.SpinWheelCore）
    ├── audio-motion.js      # 本地合成音效与摇一摇检测（window.WheelAudioMotion）
    ├── share-card.js        # 1080×1440 决定签海报绘制（window.WheelShareCard）
    └── app.js               # 主控制器与交互逻辑
```

## 兼容性与安全合规

- **离线容器 CSP**：零外链 CDN/字体/图片，零内联 `<script>` 与 `onclick=`，全经典脚本（无 `type="module"`、`import`/`export`），零禁用传感器或网络 API（`fetch` / `XHR` / `DeviceMotionEvent` / `eval` / `Worker` 等均为 0）。
- **Android 8.1 Chrome 61 (ES2017) 基线**：
  - JS 仅使用 ES2017 及以下语法，替换 `ctx.resetTransform()` 为 `ctx.setTransform(1, 0, 0, 1, 0, 0)`，`ResizeObserver` 与 `MediaQueryList.addEventListener` 均做能力检测与回退，DPR 渲染封顶为 `Math.min(dpr, 2)`。
  - CSS 采用 Flex `margin` 基线 + JS `supportsFlexGap()` 布局实测增强、纯色背景兜底 + `@supports` 毛玻璃、`:focus` 基线 + `:focus-visible` 增强、物理定位与 `padding-top` 比例盒、`@supports (padding-top: env(...))` 安全区回退、`prefers-reduced-motion` 支持及 `::-webkit-scrollbar` 降级。

## 打包命令

```bash
cd spin-wheel-minitool/dist && rm -f ../../spin-wheel-minitool.zip && zip -r ../../spin-wheel-minitool.zip . -x '*.DS_Store'
```

## 验证与待实测说明

- 已完成：`audit_artifact.py` 体积门禁、`node --check` 全部 JS 语法校验、CSP/ES2017/CSS 静态扫描、Node VM Mock 全链路冒烟测试。
- **未在真机实测**：Chrome 61（Android 8.1）真机兼容性、小红书创服平台模拟器与真机容器实测性能尚未在真实设备运行，交付上传创服平台后请依次完成 **平台模拟器验证 → Android 真机扫码验证 → iOS 真机扫码验证**。
