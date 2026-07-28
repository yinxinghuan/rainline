# 《Rainline / 雨界》技术文档

## 1. 技术栈

- React 18 + TypeScript，Vite 6.4.3 构建，Less 管理界面样式。
- 玩法与雨面使用 Canvas 2D；头像保留连续 SVG 回退，并在不读取像素的前提下，
  将同一张真实头像按对应细网格绘入第二个 Canvas，形成可局部位移的粒子肖像。
- 圈地、路径、洪泛分区、风暴和雨针碰撞全部在 CPU 的确定性逻辑网格中计算；
  Canvas 雨滴、涟漪、发光和捕获闪光只消费状态，不参与胜负判定。
- 身份请求使用同步进项目的 canonical `@shared/runtime` bridge 和
  `callAigramAPI()`。
- 音效由 Web Audio 合成；无外部音频文件。
- 构建 `base: './'`，静态资源可随任意部署子路径移动。

## 2. 目录结构

- `src/Rainline/engine.ts`：72×104 逻辑网格、路径移动、线段碰撞、洪泛捕获、
  风暴/雨针、计时、生命、分数和 QA 强制状态。
- `src/Rainline/render.ts`：独立 Canvas 雨面、雨滴、涟漪、领地边界、live trail、
  风暴与反馈绘制。
- `src/Rainline/portrait.ts`：跨域安全的头像 cover 裁切、占领格映射、细网格绘制、
  触点局部位移和捕获波。
- `src/Rainline/Rainline.tsx`：RAF 生命周期、Pointer Events、响应式 UI、SVG
  身份遮罩、结果、分享和可访问状态。
- `src/Rainline/Rainline.less`：Storm Cartography 视觉 token、双尺寸布局、
  控件状态和降低动态规则。
- `src/Rainline/useIdentity.ts`：调试覆盖、当前玩家资料、canonical 默认头像及错误恢复。
- `src/Rainline/audio.ts`：水滴、占领、受击、胜负合成音。
- `src/Rainline/i18n.ts`：zh/en 文案和 locale 检测。
- `src/shared/runtime/`：从 workspace canonical runtime 原样同步的平台桥。
- `public/alteru-default-avatar.jpg`：项目规则指定的黑白塑封 U 回退头像。
- `public/poster.png`：Aigram transit 制作的 1024×1024 正式海报。
- `scripts/verify-engine.ts`：无需浏览器的确定性玩法合同检查。
- `_qa/ui/`：目标尺寸与关键状态的真实浏览器证据。

## 3. 核心模块

### 状态与主循环

`RainlineEngine` 保存权威状态。React 组件只持有约每 70 ms 更新一次的 UI 快照；
RAF 每帧推进引擎并绘制 Canvas，避免把高频路径和天气数据放进 React 重渲染。
页面隐藏或棋盘可见比例低于 15% 时停止推进逻辑和渲染状态。

阶段包括 `ready`、`playing`、`hit`、`paused`、`won`、`failed-lives` 与
`failed-time`。倒计时只在第一条路径进入未占领区后开始。路径头以 310 逻辑 px/s
起步，按触点距离连续提升到 520；边界外 34 px 内可吸附到最近安全格。玩家松手后
保留 580 ms 追赶窗口；仍未闭合才安全撤回并中断连锁。

### 确定性圈地

棋盘逻辑尺寸为 360×522，离散为 72×104 网格。四周边界与底部 8 个内部行初始化为
安全区，显示占领率 8%。live trail 以线段集合保存并栅格化成 3-cell 宽障碍；闭合
后从主风暴所在格执行四邻域洪泛，风暴可达侧保持未占领，其余格成为新领地。

主风暴在未占领区反弹，速度随 35%/55% 占领率提高。55% 后每约 5.4 秒生成带
260 ms 预警的雨针。两种威胁都用线段距离检查 live trail；视觉发光宽度不会改变
碰撞半径。

### 屏幕与输入

棋盘保持 360:522 的固定逻辑比例，DOM HUD 与结果层响应式布局。AlterU
`platform-layout` 在 390×844 使用约 358×519，在 320×568 使用约 296×418。
外部 guest banner 由远程 shell 管理，是覆盖式 CTA；游戏源码不会隐藏它，也不会
为它永久下移 HUD、棋盘或相机。

核心手势只使用 Pointer Events：已占领区域 `pointerdown` 起线、pointer capture
跟踪、`pointerup/pointercancel` 结束。暂停、声音、重试与分享使用 `onClick`。
所有 DOM 按钮不小于 44×44 CSS px。

### 身份、隐私与降级

身份顺序为 `?avatar_url=` / `?user_name=` 调试覆盖 → Aigram 当前玩家 →
canonical 默认 U 与平台外 `AlterU`。平台资料读取
`/note/telegram/user/get/info/by/telegram_id?telegram_id=…` 的 `data.name` 和
`data.head_url`；`data.user_name` 只用于旧数据兼容。

头像不设置 `crossOrigin`，不进行 `getImageData`、`toDataURL`、`toBlob` 或导出。
浏览器允许把无 CORS 图像绘入会被污染的 Canvas；`portrait.ts` 只按原图对应位置做
细网格裁切和局部位移，从不读回。连续 SVG 层保留为加载/错误回退。资料失败显示
可重试错误，玩法仍保留默认 U 雨面；分享只发送结果文案和深链。

### 视觉与效果边界

- `rain-puddle-surface`：采用雨量与湿度分离合同，但雨面为 Canvas 独立实现，
  每个可见雨滴对应确定性落点、飞溅与扩散环；湿面反射在停雨后仍保留。没有复制
  GPL consumer。
- `interactive-image-particle-field`：采用 Skill 的无像素读回 Canvas 降级合同，
  真实头像细网格在路径头和捕获波附近发生局部位移；没有复制 Codrops shader
  或示例肖像。
- `luminous-path-trails`：采用“头部驱动、历史形成身体”的交互合同，以 Canvas
  双层亮芯、流动节点和闭合/断裂余迹实现；正式 WebGPU history 模块未启用。
- `fft-convolution-bloom`、`accumulated-bokeh-field`：MVP 未启用。六叶捕获光芒
  与结果五边形高光是明确标注的低成本视觉降级，不冒充 FFT 或浮点累积。
- `particle-morph-field`：按策划明确排除。

`?baseline=1` 显示效果诊断标签，便于确认 CPU geometry、DOM identity 和雨面分层，
但不冒充外部作品的源码复刻基线。

### 音频、多语言与本地状态

声音默认关闭，用户开启后才创建/恢复 AudioContext。静音不影响视觉警告。
`game_locale` 可固定 zh/en；否则按浏览器语言检测。最高分仅保存在
`rainline_best` localStorage。首版不接排行榜、跨设备存档或好友选择器。

## 4. 扩展点

- 改局长、生命、胜利阈值和逻辑尺寸：`src/Rainline/types.ts`。
- 调路径速度、风暴、雨针、捕获算法和计分：`src/Rainline/engine.ts`。
- 调雨量、落点、涟漪、湿面反射、边界、光迹和性能档：`src/Rainline/render.ts`。
- 调头像粒子密度、局部位移和捕获波：`src/Rainline/portrait.ts`。
- 改 HUD、结果、身份遮罩、分享和状态结构：`src/Rainline/Rainline.tsx`。
- 改色彩、排版、安全区和响应式：`src/Rainline/Rainline.less`，同步更新
  `doc/visual.md`。
- 改中英文案：`src/Rainline/i18n.ts`。
- 接入排行榜时需整体加入冠军入口、完整榜单、头像/资料跳转和 `score_beat`，
  不能只加技术按钮。
- 接入好友肖像时必须增加明确选择与分享确认，头像仍不得未经授权上传或读回 Canvas。
- 永久 UUID 为 `13fd84e9-0d92-48a3-8693-2f1fc0a1b570`，已与 `games.json`
  和 `src/game-id.ts` 同步；线上入口为 `https://yinxinghuan.github.io/rainline/`。
