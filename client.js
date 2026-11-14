/**
 * dsh-turn-hider — Client half（纯前端）。
 *
 * 在聊天记录里隐藏任意一轮：那一轮的用户消息、AI 回复、工具过程与用量行
 * 一起从画面上消失。只动浏览器里的显示 —— 会话日志、投影缓存、搜索索引
 * 一概不碰；隐藏清单按「会话 id + 轮号」存在浏览器 localStorage，刷新、
 * 重开、换窗口之后继续生效，随时可以在面板里逐条或全部恢复。
 *
 * 交互：
 *  - 鼠标悬停任意一轮的行 → 行右上角浮出「隐藏此轮」按钮；
 *  - 点击即隐藏，底部弹提示（带撤销）；
 *  - 右下角常驻小徽标「已隐藏 N 轮」→ 点开管理面板：逐条恢复 / 全部恢复。
 *
 * 行 → 轮 的判定（多层兜底，任何一层命中即止）：
 *  1. 行自带标记：data-chat-turn / data-turn-tail / data-turn-process；
 *  2. React fiber props：routedNode.location.turn.turn，或组件的 turn prop；
 *  3. 行类型启发：data-chat-flow-kind 含 assistant → 归上一组，含 user/input → 归下一组；
 *  4. 顺序兜底：夹在两组之间的未知行归入后一组（下一轮的输入行），只有前组的归前组。
 */

window.__ModuleLoader__.load({
  id: "dsh-turn-hider",
  factory() {
    "use strict";

    const NS = "dsh-turn-hider";
    const STORE_KEY = NS + ":hidden:v1";
    const HIDDEN_ATTR = "data-dth-hidden";
    const TURN_ATTR = "data-dth-turn";

    const CSS = [
      "#dsh-turn-hider-root{position:fixed;inset:auto;z-index:2147483000;font:13px/1.5 -apple-system,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif}",
      ".dth-hover-btn{position:fixed;display:none;z-index:2147483001;align-items:center;padding:3px 10px;border-radius:8px;border:1px solid rgba(127,127,127,.35);background:var(--dsw-alias-bg-layer-2,#1b1d21);color:var(--dsw-alias-label-primary,#e6e6e6);font:inherit;font-size:12px;line-height:18px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25)}",
      ".dth-hover-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.18))}",
      ".dth-chip{position:fixed;right:18px;bottom:18px;z-index:2147483000;display:none;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;border:1px solid rgba(127,127,127,.3);background:var(--dsw-alias-bg-layer-2,#1b1d21);color:var(--dsw-alias-label-secondary,#a8adb7);font:inherit;font-size:12px;line-height:18px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.22)}",
      ".dth-chip:hover{color:var(--dsw-alias-label-primary,#e6e6e6)}",
      ".dth-panel{position:fixed;right:18px;bottom:58px;width:350px;max-width:calc(100vw - 36px);max-height:min(62vh,560px);display:none;flex-direction:column;border-radius:14px;border:1px solid rgba(127,127,127,.28);background:var(--dsw-alias-bg-layer-1,#f7f8fa);color:var(--dsw-alias-label-primary,#e6e6e6);box-shadow:0 10px 34px rgba(0,0,0,.3);overflow:hidden}",
      ".dth-panel.dth-open{display:flex}",
      ".dth-panel-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 14px;border-bottom:1px solid rgba(127,127,127,.18);font-weight:600;font-size:13px}",
      ".dth-panel-close{flex:none;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border:none;border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary,#a8adb7);cursor:pointer;font:inherit;font-size:15px;line-height:1}",
      ".dth-panel-close:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14));color:var(--dsw-alias-label-primary,#e6e6e6)}",
      ".dth-panel-note{padding:8px 14px 0;font-size:11.5px;line-height:17px;color:var(--dsw-alias-label-tertiary,#8b909a)}",
      ".dth-panel-list{overflow:auto;padding:8px 10px;display:flex;flex-direction:column;gap:6px}",
      ".dth-item{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:10px;border:1px solid rgba(127,127,127,.16);background:var(--dsw-alias-bg-layer-2,#1b1d21)}",
      ".dth-item-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}",
      ".dth-item-title{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary,#e6e6e6)}",
      ".dth-item-preview{font-size:11.5px;color:var(--dsw-alias-label-secondary,#a8adb7);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".dth-item-btn{flex:none;padding:3px 10px;border-radius:8px;border:1px solid rgba(127,127,127,.3);background:transparent;color:var(--dsw-alias-state-business-primary,#4a8cff);font:inherit;font-size:12px;line-height:18px;cursor:pointer}",
      ".dth-item-btn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.14))}",
      ".dth-empty{padding:18px 14px;text-align:center;color:var(--dsw-alias-label-tertiary,#8b909a);font-size:12.5px}",
      ".dth-panel-foot{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:10px 14px;border-top:1px solid rgba(127,127,127,.18)}",
      ".dth-foot-btn{padding:4px 12px;border-radius:8px;border:1px solid rgba(127,127,127,.3);background:transparent;color:var(--dsw-alias-label-primary,#e6e6e6);font:inherit;font-size:12px;line-height:18px;cursor:pointer}",
      ".dth-foot-btn:disabled{opacity:.4;cursor:not-allowed}",
      ".dth-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);display:none;align-items:center;gap:10px;padding:9px 16px;border-radius:10px;border:1px solid rgba(127,127,127,.3);background:var(--dsw-alias-bg-layer-2,#1b1d21);color:var(--dsw-alias-label-primary,#e6e6e6);box-shadow:0 8px 24px rgba(0,0,0,.3);z-index:2147483002;font-size:12.5px}",
      ".dth-toast-btn{border:none;background:transparent;color:var(--dsw-alias-state-business-primary,#4a8cff);font:inherit;font-size:12.5px;cursor:pointer;padding:0}",
      "[" + HIDDEN_ATTR + "=1]{display:none !important}",
    ].join("\n");

    // ---------- 状态 ----------
    let uiSession = null;
    let rootEl = null, chipEl = null, panelEl = null, panelListEl = null;
    let panelRestoreAllBtn = null, hoverBtn = null, toastEl = null, toastUndoBtn = null;
    let panelOpen = false, toastTimer = 0, toastUndo = null;

    // ---------- localStorage ----------
    function readStore() {
      try {
        const v = JSON.parse(window.localStorage.getItem(STORE_KEY) || "{}");
        return v && typeof v === "object" ? v : {};
      } catch (e) { return {}; }
    }
    function writeStore(store) {
      try { window.localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) { /* 无存储的壳仍对本页生效 */ }
    }
    function hiddenMap(sid) {
      const store = readStore();
      return store[sid] && typeof store[sid] === "object" ? store[sid] : {};
    }
    function putHidden(sid, turn, rec) {
      const store = readStore();
      const map = store[sid] && typeof store[sid] === "object" ? store[sid] : (store[sid] = {});
      map[String(turn)] = rec;
      writeStore(store);
    }
    function dropHidden(sid, turn) {
      const store = readStore();
      if (turn === undefined) delete store[sid];
      else if (store[sid] && typeof store[sid] === "object") delete store[sid][String(turn)];
      writeStore(store);
    }

    // ---------- 当前会话 ----------
    function sessionId() {
      try {
        const binding = uiSession && uiSession.current;
        const value = binding && binding.value;
        if (value && typeof value.key === "string" && value.key) return value.key;
      } catch (e) { /* 服务未就绪时走 DOM 兜底 */ }
      const m = String(window.location.hash || window.location.pathname || "")
        .match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      return m ? "session-" + m[0] : "__page__";
    }

    // ---------- 行 → 轮 ----------
    function flowContainer() {
      const anyGroup = document.querySelector("[" + TURN_ATTR + "],[data-chat-turn]");
      return anyGroup ? anyGroup.parentElement : null;
    }
    function rowsOf(container) {
      const rows = [];
      for (const el of container.children) if (el && el.nodeType === 1) rows.push(el);
      return rows;
    }
    function toTurn(value) {
      const n = Number(value);
      return Number.isFinite(n) && n >= 0 ? n : null;
    }
    function directTurn(row) {
      if (row.hasAttribute("data-chat-turn")) return toTurn(row.getAttribute("data-chat-turn"));
      if (row.hasAttribute("data-turn-tail")) return toTurn(row.getAttribute("data-turn-tail"));
      if (row.hasAttribute("data-turn-process")) return toTurn(row.getAttribute("data-turn-process"));
      return null;
    }
    function fiberTurn(row) {
      try {
        const fk = Object.keys(row).find(function (k) { return k.indexOf("__reactFiber$") === 0; });
        if (!fk) return null;
        let fiber = row[fk];
        let depth = 0;
        while (fiber && depth < 30) {
          const props = fiber.memoizedProps;
          if (props && typeof props === "object") {
            if (typeof props.turn === "number") return props.turn;
            const node = props.routedNode || props.node;
            const loc = node && node.location;
            if (loc && loc.turn && typeof loc.turn.turn === "number") return loc.turn.turn;
          }
          fiber = fiber.return;
          depth += 1;
        }
      } catch (e) { /* fiber 不可用时走启发 */ }
      return null;
    }
    function assignTurns(rows) {
      const turns = new Array(rows.length).fill(null);
      for (let i = 0; i < rows.length; i++) {
        const t = directTurn(rows[i]);
        turns[i] = t !== null ? t : fiberTurn(rows[i]);
      }
      for (let i = 0; i < rows.length; i++) {
        if (turns[i] !== null) continue;
        const kind = rows[i].getAttribute("data-chat-flow-kind") || "";
        if (/assistant|reply/i.test(kind)) {
          for (let j = i - 1; j >= 0; j--) if (turns[j] !== null) { turns[i] = turns[j]; break; }
        } else if (/user|input|trigger/i.test(kind)) {
          for (let j = i + 1; j < rows.length; j++) if (turns[j] !== null) { turns[i] = turns[j]; break; }
        }
      }
      for (let i = 0; i < rows.length; i++) {
        if (turns[i] !== null) continue;
        let prev = null, next = null;
        for (let j = i - 1; j >= 0; j--) if (turns[j] !== null) { prev = turns[j]; break; }
        for (let j = i + 1; j < rows.length; j++) if (turns[j] !== null) { next = turns[j]; break; }
        if (prev !== null && next !== null) turns[i] = next;
        else turns[i] = prev !== null ? prev : next;
      }
      return turns;
    }

    // ---------- 扫描与隐藏 ----------
    function scanAndApply() {
      const container = flowContainer();
      if (!container) { updateChip(); return; }
      const rows = rowsOf(container);
      const turns = assignTurns(rows);
      const hidden = hiddenMap(sessionId());
      for (let i = 0; i < rows.length; i++) {
        const turn = turns[i];
        if (turn === null) continue;
        const row = rows[i];
        if (row.getAttribute(TURN_ATTR) !== String(turn)) row.setAttribute(TURN_ATTR, String(turn));
        const want = hidden[String(turn)] ? "1" : null;
        if (want) {
          if (row.getAttribute(HIDDEN_ATTR) !== "1") row.setAttribute(HIDDEN_ATTR, "1");
        } else if (row.getAttribute(HIDDEN_ATTR) === "1") {
          row.removeAttribute(HIDDEN_ATTR);
        }
      }
      updateChip();
    }
    function membersOf(turn) {
      const container = flowContainer();
      if (!container) return [];
      const rows = rowsOf(container);
      const turns = assignTurns(rows);
      const members = [];
      for (let i = 0; i < rows.length; i++) if (turns[i] === turn) members.push(rows[i]);
      return members;
    }
    function hideTurn(turn) {
      const sid = sessionId();
      const members = membersOf(turn);
      if (!members.length) { toast("没有找到第 " + turn + " 轮的可见内容", null); return; }
      let preview = "";
      for (const row of members) {
        const text = (row.textContent || "").replace(/\s+/g, " ").trim();
        if (text) { preview = text.slice(0, 80); break; }
      }
      putHidden(sid, turn, { at: Date.now(), preview: preview || ("第 " + turn + " 轮") });
      scanAndApply();
      renderPanel();
      toast("已隐藏第 " + turn + " 轮（仅显示层，会话记录未动）", function () { restoreTurn(turn); });
    }
    function restoreTurn(turn) {
      dropHidden(sessionId(), turn);
      scanAndApply();
      renderPanel();
    }
    function restoreAll() {
      dropHidden(sessionId(), undefined);
      scanAndApply();
      renderPanel();
    }

    // ---------- UI ----------
    function el(tag, cls, text) {
      const node = document.createElement(tag);
      if (cls) node.className = cls;
      if (text !== undefined && text !== null) node.textContent = text;
      return node;
    }
    function buildUI() {
      rootEl = el("div");
      rootEl.id = "dsh-turn-hider-root";

      hoverBtn = el("button", "dth-hover-btn", "隐藏此轮");
      hoverBtn.type = "button";
      hoverBtn.__dthTurn = null;
      hoverBtn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        const turn = hoverBtn.__dthTurn;
        hideHover();
        if (turn !== null && turn !== undefined) hideTurn(turn);
      });

      chipEl = el("button", "dth-chip", "轮次隐藏");
      chipEl.type = "button";
      chipEl.title = "dsh-turn-hider：管理本会话已隐藏的轮次";
      chipEl.addEventListener("click", function () { setPanelOpen(!panelOpen); });

      panelEl = el("div", "dth-panel");
      const head = el("div", "dth-panel-head");
      head.appendChild(el("span", null, "已隐藏的轮次"));
      const closeBtn = el("button", "dth-panel-close", "✕");
      closeBtn.type = "button";
      closeBtn.addEventListener("click", function () { setPanelOpen(false); });
      head.appendChild(closeBtn);
      panelEl.appendChild(head);
      const note = el("div", "dth-panel-note",
        "只对当前会话生效；隐藏仅作用于本浏览器的前端显示，会话日志与记录完全不动，随时恢复。");
      panelEl.appendChild(note);
      panelListEl = el("div", "dth-panel-list");
      panelEl.appendChild(panelListEl);
      const foot = el("div", "dth-panel-foot");
      panelRestoreAllBtn = el("button", "dth-foot-btn", "全部恢复");
      panelRestoreAllBtn.type = "button";
      panelRestoreAllBtn.addEventListener("click", function () { restoreAll(); });
      foot.appendChild(panelRestoreAllBtn);
      const footTip = el("span", null, "dsh-turn-hider");
      footTip.style.cssText = "font-size:11px;color:var(--dsw-alias-label-tertiary,#8b909a)";
      foot.appendChild(footTip);
      panelEl.appendChild(foot);

      toastEl = el("div", "dth-toast");
      toastUndoBtn = el("button", "dth-toast-btn", "撤销");
      toastUndoBtn.type = "button";
      toastUndoBtn.addEventListener("click", function () {
        const undo = toastUndo;
        hideToast();
        if (typeof undo === "function") undo();
      });
      toastEl.appendChild(el("span", "dth-toast-msg"));
      toastEl.appendChild(toastUndoBtn);

      rootEl.appendChild(hoverBtn);
      rootEl.appendChild(chipEl);
      rootEl.appendChild(panelEl);
      rootEl.appendChild(toastEl);
      (document.body || document.documentElement).appendChild(rootEl);
      renderPanel();
    }
    function setPanelOpen(next) {
      panelOpen = !!next;
      if (panelEl) panelEl.classList.toggle("dth-open", panelOpen);
      if (panelOpen) renderPanel();
    }
    function updateChip() {
      if (!chipEl) return;
      const inChat = flowContainer() !== null;
      const count = Object.keys(hiddenMap(sessionId())).length;
      chipEl.style.display = inChat ? "flex" : "none";
      chipEl.textContent = count > 0 ? "已隐藏 " + count + " 轮" : "轮次隐藏";
    }
    function renderPanel() {
      if (!panelListEl) return;
      const sid = sessionId();
      const entries = Object.keys(hiddenMap(sid))
        .map(function (k) { return { turn: Number(k), rec: hiddenMap(sid)[k] }; })
        .filter(function (it) { return Number.isFinite(it.turn) && it.rec; })
        .sort(function (a, b) { return b.turn - a.turn; });
      panelListEl.textContent = "";
      if (!entries.length) {
        panelListEl.appendChild(el("div", "dth-empty", "这个会话还没有隐藏任何轮次。\n悬停某轮对话，点右上角「隐藏此轮」。"));
      }
      for (const it of entries) {
        const item = el("div", "dth-item");
        const main = el("div", "dth-item-main");
        main.appendChild(el("span", "dth-item-title", "第 " + it.turn + " 轮"));
        main.appendChild(el("span", "dth-item-preview", it.rec.preview || ""));
        item.appendChild(main);
        const btn = el("button", "dth-item-btn", "恢复");
        btn.type = "button";
        btn.addEventListener("click", function () { restoreTurn(it.turn); });
        item.appendChild(btn);
        panelListEl.appendChild(item);
      }
      if (panelRestoreAllBtn) panelRestoreAllBtn.disabled = entries.length === 0;
      updateChip();
    }
    function toast(msg, undo) {
      if (!toastEl) return;
      toastEl.querySelector(".dth-toast-msg").textContent = msg;
      toastUndo = undo || null;
      toastUndoBtn.style.display = undo ? "inline" : "none";
      toastEl.style.display = "flex";
      if (toastTimer) window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(hideToast, 6000);
    }
    function hideToast() {
      if (toastEl) toastEl.style.display = "none";
      toastUndo = null;
      if (toastTimer) { window.clearTimeout(toastTimer); toastTimer = 0; }
    }
    function hideHover() {
      if (hoverBtn) hoverBtn.style.display = "none";
      if (hoverBtn) hoverBtn.__dthTurn = null;
    }
    function onOver(e) {
      const target = e.target;
      if (!target || typeof target.closest !== "function") return;
      const row = target.closest("[" + TURN_ATTR + "]");
      if (!row || row.getAttribute(HIDDEN_ATTR) === "1") { hideHover(); return; }
      const turn = toTurn(row.getAttribute(TURN_ATTR));
      if (turn === null) { hideHover(); return; }
      const rect = row.getBoundingClientRect();
      if (rect.bottom < 40 || rect.top > window.innerHeight - 40) { hideHover(); return; }
      hoverBtn.__dthTurn = turn;
      hoverBtn.style.display = "flex";
      hoverBtn.style.top = Math.max(8, Math.min(rect.top + 6, window.innerHeight - 44)) + "px";
      hoverBtn.style.left = Math.max(8, Math.min(rect.right - 86, window.innerWidth - 104)) + "px";
    }

    return {
      inject: ["uiSession"],
      apply(ctx) {
        if (window.__DSH_TURN_HIDER__) return;
        window.__DSH_TURN_HIDER__ = true;
        try { uiSession = ctx.get("uiSession") || null; } catch (e) { uiSession = null; }

        const style = document.createElement("style");
        style.setAttribute("data-dsh-plugin", NS);
        style.textContent = CSS;
        (document.head || document.documentElement).appendChild(style);
        buildUI();

        document.addEventListener("mouseover", onOver, true);
        document.addEventListener("scroll", hideHover, true);

        let scheduled = false;
        const observer = new MutationObserver(function () {
          if (scheduled) return;
          scheduled = true;
          window.setTimeout(function () {
            scheduled = false;
            try { scanAndApply(); } catch (e) { /* 单轮扫描失败不影响下一轮 */ }
          }, 60);
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
        try { scanAndApply(); } catch (e) { /* 首扫时页面可能还没有聊天区 */ }

        const timer = window.setInterval(function () {
          try { updateChip(); if (panelOpen) renderPanel(); } catch (e) { /* 忽略单次刷新失败 */ }
        }, 1500);

        ctx.effect(function () {
          return function () {
            observer.disconnect();
            window.clearInterval(timer);
            document.removeEventListener("mouseover", onOver, true);
            document.removeEventListener("scroll", hideHover, true);
            try { rootEl.remove(); } catch (e) { /* 已被移除 */ }
            try { style.remove(); } catch (e) { /* 已被移除 */ }
            window.__DSH_TURN_HIDER__ = false;
          };
        }, "dsh-turn-hider: ui");
      },
    };
  },
});
