# dsh-turn-hider

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.5-blue.svg)](https://github.com/amd47802574/dsh-turn-hider/releases)
[![Platform](https://img.shields.io/badge/platform-DSH%20Web%20%2F%20Desktop-8b5cf6.svg)](#compatibility)
[![Type](https://img.shields.io/badge/type-client--only%20plugin-22c55e.svg)](#how-it-works)

**Hide any single chat turn from the DeepSeek Harness (DSH) transcript — display only.**

One click on the trash icon at the end of a message's icon row, and that whole turn
(user message + assistant reply + tool activity + usage line) disappears from the
conversation view. Nothing else changes: session logs, projection caches, the
full-text search index and the model's context are **never touched**. Every hidden
turn can be restored at any time.

> 为什么做这个 / 中文说明见 [README.zh.md](README.zh.md)

---

## ✨ Features

- 🗑 **One-click turn hiding** — a trash button is injected at the tail of every
  message's built-in icon row (copy / like / dislike / summary / share / time).
  Clicking it hides that entire turn from the transcript.
- ↩️ **Non-destructive by design** — display-layer only. The session's
  `session.v4.jsonl.zstd` log, projection cache and search index stay exactly as
  they were; the model still sees the hidden content in later turns.
- 🧠 **Per-turn memory** — hidden turns are recorded as *(session id, turn number)*
  pairs in browser `localStorage`. They survive page reloads, app restarts and
  re-entry into the session, and are scoped per session.
- 🧩 **Restore anywhere, anytime** — a floating badge ("已隐藏 N 轮") opens a
  management panel listing every hidden turn with a text preview, with per-turn
  **Restore** and **Restore all** buttons. A toast with **Undo** appears right
  after each hide.
- 🎨 **Theme aware** — the panel, badge and toast use DSH theme tokens
  (`--dsw-alias-*`), so light/dark themes are followed automatically.
- 🔌 **Zero backend** — the host half is a mount anchor only. No routes, no file
  system access, no data leaves the browser.

## 📦 Installation

### Option A — local folder (Desktop)

1. Clone or download this repo to a stable path, e.g.
   `F:/desktop/草稿文件/dsh产物/dsh-turn-hider`;
2. Edit `~/.dsh/profiles/desktop/package.json`:
   - add to `dependencies`: `"dsh-turn-hider": "file:F:/desktop/草稿文件/dsh产物/dsh-turn-hider"`
   - add to `dsh.profile.bundles`: `"dsh-turn-hider"`
3. Run `pnpm install` inside the profile directory (or simply create a junction:
   `mklink /J "%USERPROFILE%\.dsh\profiles\desktop\node_modules\dsh-turn-hider" "<this folder>"`);
4. Restart the DSH desktop app.

### Option B — from GitHub (Desktop / Web profile)

```bash
dsh plugin add github:amd47802574/dsh-turn-hider
```

or install it from any plugin manager that reads GitHub sources, then restart.

### Option C — plugin marketplace

A PR to the DSH plugin marketplace is planned; once merged, the plugin appears in
the in-app store search.

## 🕹 Usage

1. Open any session in the DSH web UI;
2. Hover a message: its icon row shows
   `copy 👍 👎 summary share 🗑 22:53` — the trash sits right before the clock;
3. Click **🗑** → the whole turn (user message + reply + tool process) vanishes
   and a toast with **撤销 / Undo** appears for 6 seconds;
4. Click the **轮次隐藏** tab at the end of the top tab bar (对话 / 上下文 / 编队 / …) to open the panel:
   - each row shows the turn number + first line preview + a **恢复 / Restore** button;
   - **全部恢复 / Restore all** clears the session's hidden list at once.

## ⚙️ How it works

```
chat flow rows (seats)
├─ user message row      (icon row clock="start")  ─┐
├─ tool process group    (data-chat-turn="N")       ├─ turn block N
├─ assistant reply row   (icon row clock="end")    ─┘
└─ turn tail / usage     (data-turn-tail="N")
```

- **Turn blocks** are anchored on user messages: one block = one user message plus
  every flow row before the next user message. Block boundaries therefore only
  depend on the user-message sequence, which is stable across reloads and paging.
- **Block → turn number** resolution order: direct markers on the row
  (`data-chat-turn` / `data-turn-tail` / `data-turn-process`) → React fiber props
  (`routedNode.location.turn.turn`, or a `turn` prop) → ordinal count of user
  messages.
- **Hiding** sets `data-dth-hidden="1"` on every row of the block; a single CSS
  rule (`display:none !important`) collapses it. A debounced `MutationObserver`
  re-applies the state whenever React re-renders or history pages in.
- **Trash button injection** clones the row's own action button (identical class
  names, size and color) and swaps in a trash glyph, so it always matches the
  active theme; if React removes it during reconciliation, the next scan re-adds it.
- **Persistence** lives in `localStorage["dsh-turn-hider:hidden:v1"]` keyed by
  session id.

## ❓ FAQ

**Does the model still see hidden turns?**
Yes. This is a display-layer tool; the next request still carries the hidden
content. Use it to declutter your view, not to erase context.

**Is anything deleted?**
No. Logs, caches, indexes and session state are untouched. Hiding is reversible
and local to your browser profile.

**Does it sync across browsers/devices?**
No — the hidden list is per browser (localStorage). Different windows of the same
browser share it.

**Does hiding survive app restarts?**
Yes, as long as the same browser profile is used.

## 🧯 Troubleshooting

| Symptom | Fix |
|---|---|
| No trash button on icon rows | Restart DSH after installing; the bundle loads at startup |
| Click does nothing | Update to ≥ 0.1.1 (user-message-anchored blocks) and restart |
| Badge missing | You are not inside a session view; open a conversation first |
| A turn comes back after scrolling | History re-paged in; the observer re-hides it within ~100 ms |

## 🧹 Uninstall

Remove `dsh-turn-hider` from `dsh.profile.bundles` and `dependencies` (or
uninstall via the plugin manager), then restart. To wipe the hidden list, clear
the `dsh-turn-hider:hidden:v1` key from localStorage.

## 🤝 Compatibility

| Host | Status |
|---|---|
| DSH Desktop (Electron web UI) 0.2.x | ✅ tested |
| DSH Web profile (`dsh web`) | expected to work (same client runtime) |
| Chat themes | tokens-based, follows light/dark |

## 🗺 Roadmap

- [ ] Marketplace submission (PR to the plugin index)
- [ ] Optional: hide-from-context toggle with explicit warning
- [ ] Multi-select hiding from the panel

## 🧑‍💻 Development

No build step: `client.js` is hand-written in the official client-bundle shape
(`window.__ModuleLoader__.load({ id, factory })`), `host.js` is a no-op cordis
service. `node --check client.js` is the only validation needed.

```
dsh-turn-hider/
├── client.js          # browser half: scan, hide, inject, panel, storage
├── host.js            # cordis mount anchor (no-op)
├── cordis.patch.yml   # bundle patch: insert the anchor service
├── package.json       # dsh.bundle.patch + dsh.client declarations
└── icon.svg
```

PRs welcome — keep the display-only guarantee: **never touch session data**.

## 📄 License

[MIT](LICENSE) © amd47802574
