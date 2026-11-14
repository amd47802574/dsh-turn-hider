# dsh-turn-hider

Hide any single chat turn (user message + assistant reply + tool activity) from the
DSH (DeepSeek Harness) transcript view.

Display-only by design: session logs, projection caches and the full-text search
index are never touched, and the model still sees the hidden content in later turns.
Hidden turns are remembered per (session id, turn number) in browser localStorage,
survive reloads, and can be restored one by one or all at once from the floating
panel.

## Install (Desktop)

1. Put this folder anywhere stable;
2. In `~/.dsh/profiles/desktop/package.json` add the dependency
   `"dsh-turn-hider": "file:<path-to-this-folder>"` and add `"dsh-turn-hider"`
   to `dsh.profile.bundles`;
3. Run `pnpm install` inside the profile directory;
4. Restart the DSH desktop app.

## Usage

Hover any row of a turn -> a "隐藏此轮" (hide this turn) button appears at the
row's top-right; click to hide. The badge at the bottom-right ("已隐藏 N 轮")
opens the management panel with per-turn restore and restore-all.

## License

MIT
