# Rainline MVP QA 报告

日期：2026-07-28

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
