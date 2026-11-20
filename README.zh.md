# dsh-turn-hider · 会话轮次隐藏

在 DSH（DeepSeek Harness）聊天界面里**隐藏任意一轮对话** —— 那一轮的用户消息、
AI 回复、工具调用过程与用量行一起从画面上消失。

**只删"表面"**：隐藏仅作用于浏览器显示层。会话日志（`session.v4.jsonl.zstd`）、
投影缓存、全文搜索索引一概不动；模型上下文也不变 —— 下一轮对话模型依然能看到
被隐藏轮次的内容。隐藏清单按「会话 id + 轮号」存在浏览器 localStorage，
刷新、重开、换设备窗口后继续生效，随时一键恢复。

## 功能

- 消息图标行（复制 / 点赞 / 点踩 / 摘要 / 分享 / 时间）末尾的垃圾桶按钮 → 点击隐藏该轮（底部提示可撤销）；
- 左下角常驻小徽标「已隐藏 N 轮」→ 管理面板：逐条恢复 / 全部恢复，每条带首行预览；
- 按「会话 id + 轮号」记忆，换会话各自独立，重开不丢；
- 纯前端实现，无宿主路由、无文件改动；样式跟随 DSH 主题令牌（明暗自适应）。

## 安装（Desktop 桌面版）

方式一 —— 手动挂为 bundle（与本机其他插件一致）：

1. 把本目录放到任意固定位置（例如 `F:\desktop\草稿文件\dsh产物\dsh-turn-hider`）；
2. 编辑 `~/.dsh/profiles/desktop/package.json`：
   - `dependencies` 加 `"dsh-turn-hider": "file:F:/desktop/草稿文件/dsh产物/dsh-turn-hider"`；
   - `dsh.profile.bundles` 数组加 `"dsh-turn-hider"`；
3. 在 profile 目录跑 `pnpm install`；
4. 重启 DSH 桌面端。

方式二 —— 发布到 GitHub 后按仓库安装：
`dsh plugin add github:amd47802574/dsh-turn-hider`（或用插件管理器搜索安装）。

## 使用

1. 重启后进入任意会话，把鼠标悬停在某一轮对话的任意位置；
2. 行左下角出现「隐藏此轮」→ 点击，该轮（用户消息 + AI 回复 + 工具过程）整体隐藏；
3. 左下角「已隐藏 N 轮」徽标 → 打开面板，可逐条「恢复」或「全部恢复」。

## 原理与边界

- 行 → 轮 的判定依次尝试：行自带 `data-chat-turn` / `data-turn-tail` / `data-turn-process`
  标记 → React fiber props（`routedNode.location.turn.turn`）→ 行类型启发 → DOM 顺序兜底；
- 未加载进画面的历史轮次（分页加载）在滚入后按同一清单继续隐藏；
- 轮号来自会话事件流（`turn/start` 的序号），跨刷新稳定；fork 出的新会话轮号独立；
- 本插件**不改**任何会话数据；要"真删除"，请配合 better-dsh-session-deletetool（整会话删除）。

## 卸载

从 `dsh.profile.bundles` 移除 `"dsh-turn-hider"` 并删掉依赖行（或用插件管理器卸载），
重启 DSH 即可；localStorage 里的隐藏清单可在插件属性里手动清除（key：
`dsh-turn-hider:hidden:v1`）。

## License

MIT
