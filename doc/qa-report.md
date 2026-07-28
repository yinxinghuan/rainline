# Rainline MVP QA 报告

日期：2026-07-28

## v2 手感与视觉技能复验（2026-07-29）

用户反馈 v1 路径明显落后手指、视觉能力只停留在弱装饰。源码审计确认：

1. 路径头固定 230 px/s，抬手追赶仅 160 ms，快拖时容易误撤回。
2. 闭合后 `trailLength` 已清零，大小圈音效判断总是读取为小圈。
3. 雨滴与随机涟漪没有共享落点，湿面反射弱，未达到雨面合同的可见辨识度。
4. live trail 闭合后立即消失，头像点阵不响应触摸；两个能力没有进入核心循环。

v2 修复与证据：

- 路径头改为 310→520 逻辑 px/s 距离自适应追随；34 px 近岸吸附；抬手追赶
  延长到 580 ms。`scripts/verify-engine.ts` 已验证近岸起线和抬手闭合，结果占领率
  从 8% 增至 10.26%。
- 捕获保留真实路径历史、捕获强度和大小圈音效输入；`capturePower` 测试值
  0.608，闭合后 `echoTrail` 仍存在。
- 雨面把每条可见雨线对应到确定性落点、飞溅和扩散环；未占领湿面增加低频移动
  反射，胜利停雨后仍保持湿度。
- live trail 使用深色身体、暖白亮芯、流动节点和距离危险染色；闭合保留琥珀
  余迹与六叶光学峰值，断裂保留红色余迹、虚线边框和文字原因。
- 真实头像使用不读回 Canvas 的对应细网格；路径头附近产生局部旋涡位移，闭合波
  推动局部粒子后回稳。正式 WebGPU history、FFT 卷积和浮点累积散景未启用，
  文档不再把 Canvas 降级冒充正式 GPU 管线。
- 390×844 证据：
  `390x844-platform-layout-v2-idle.png`、
  `390x844-platform-layout-v2-drawing.png`、
  `390x844-platform-layout-v2-capture.png`、
  `390x844-platform-layout-v2-hit.png`、
  `390x844-platform-layout-v2-win.png`。
- 320×568 证据：
  `320x568-platform-layout-v2-idle.png`、
  `320x568-platform-layout-v2-win.png`。文档宽高等于视口，棋盘 296×418；
  声音与暂停控件均为 44×44，长英文名称未造成横向溢出。
- `external-guest` 证据：`390x844-external-guest-v2.png`；远程访客栏可见，
  body padding 保持 0，生产源码不为它改写平台构图。
- 320×568、76% 结果态 1.1 秒 CDP 采样：ScriptDuration 增量约 153.9 ms，
  TaskDuration 增量约 254.2 ms，LayoutDuration 增量约 0.4 ms。头像细网格在
  玩法态约 30 fps、结果态约 15 fps 更新，权威几何和雨面仍按主 RAF 运行。
- 浏览器 console：无 error/warning。

## 验证范围

- 真实 Chromium：390×844、320×568。
- 状态：首屏教学、正常玩法、路径切断、胜利结果。
- 身份：24 字符英文名称、默认头像；代码同时覆盖 query、平台玩家、无头像和资料错误。
- 机械检查：TypeScript/Vite 构建、确定性引擎脚本、UI strict audit、
  visual adaptation audit、相对资源路径与长按防护。

## 首轮发现与修复

1. P1：320×568 的水印压到暂停按钮。
   - 修复：水印移至页脚中央空区。
2. 发布门禁复核：外部 guest banner 是覆盖式 CTA，不是游戏安全区。
   - 修复：移除曾用于 banner 避让的永久 padding / header 隐藏规则；
     `platform-layout` 主验收以 banner 不存在的 AlterU 上下文为准。

## 复验结果

- 390×844 `platform-layout`：棋盘约 358×519，无横向滚动；胜利结果有肖像、
  姓名、4,500 分、76% 与两枚 48 px 按钮。
- 320×568 `platform-layout`：棋盘约 296×418；两枚结果按钮高 64 px，
  无横向滚动或不可达控件。
- v1 发布前首屏复验：390×844 棋盘为 358×519，320×568 棋盘为
  296×418；两种尺寸的文档宽高均等于视口，无横向或纵向溢出，声音与暂停
  控件均为 44×44 px。证据为 `390x844-platform-layout-v1.png` 与
  `320x568-platform-layout-v1.png`。
- `external-guest`：远程 banner 正常显示且源码没有隐藏它；该覆盖状态只验证 CTA，
  不作为 AlterU 内游戏构图依据。v1 证据为
  `390x844-external-guest-v1.png`，body padding 保持 0，游戏棋盘仍为
  358×519。
- 路径切断：生命从 3 降为 2，危险边框、保护环、断线语音文本共同表达，不只靠颜色。
- 教学复验：隔离的真实 `RainlineEngine` 从岸线起线、闭合并执行洪泛占领；
  `390x844-real-ghost-capture.png` 显示真实领地与头像显影，正式 HUD 仍保持 8%。
- 引擎合同：初始占领 8%；脚本闭合后占领 12.37%、得分 545；受击后 2 条生命；
  强制胜利占领 76%。
- 390×844 空闲雨面连续 1.015 秒 CDP 采样：ScriptDuration 增量约 68.3 ms，
  TaskDuration 增量约 137.3 ms，LayoutDuration 增量 0；脚本主线程占比约 6.7%，
  总 task 占比约 13.5%。这是桌面 Chromium 基础门禁，不替代真机热稳定测试。
- 浏览器 console：无 error/warning。

## v1 发布门禁

- `npm run build`：通过。
- 永久游戏 UUID：`13fd84e9-0d92-48a3-8693-2f1fc0a1b570`，已与
  `games.json` 和源码注入校验一致。
- `dist/THIRD_PARTY_NOTICES.txt`：存在且非空。
- 构建产物资源路径：相对 `./`，未发现根绝对资源路径。

## 上线后仍需真机验证

- 在 AlterU 真机桥内用真实 `telegram_id` 和不同来源无 CORS 头像复验
  `identitySource=player`。本地 MVP 已采用不会读像素的连续 SVG image 路径，
  但发布前环境没有可用真实宿主 token。
- 在至少一台中端 iPhone/Android WebView 记录 75 秒完整局的热稳定帧时间。
