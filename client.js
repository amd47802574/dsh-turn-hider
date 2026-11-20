/**
 * dsh-turn-hider — Client half（纯前端）。
 *
 * 在聊天记录里隐藏任意一轮：那一轮的用户消息、AI 回复、工具过程与用量行
 * 一起从画面上消失。只动浏览器里的显示 —— 会话日志、投影缓存、搜索索引
 * 一概不碰；隐藏清单按「会话 id + 轮号」存在浏览器 localStorage，刷新、
 * 重开、换窗口之后继续生效，随时可以在面板里逐条或全部恢复。
 *
 * 交互：
 *  - 消息下方那排图标（复制 / 点赞 / 点踩 / 摘要 / 分享 / 时间）末尾多一个
 *    「垃圾桶」按钮 —— 点它就隐藏这一整轮；
 *  - 隐藏后底部弹提示（带撤销）；
 *  - 聊天区右上角常驻小徽标「已隐藏 N 轮」（以聊天容器顶缘为锚，自动避开
 *    应用标题栏 / 工具栏）→ 打开管理面板：逐条恢复 / 全部恢复。
 *
 * 分块模型（v0.1.1）：一轮 = 「一条用户消息」到「下一条用户消息」之前的所有
 * 流行（seat）。以行内的图标行 data-clock 识别用户消息（clock=start）与
 * AI 回复（clock=end）；块内任何一行带 data-chat-turn / data-turn-tail /
 * data-turn-process 直接标记时优先采用其轮号，否则用 fiber props
 * （routedNode.location.turn.turn / props.turn），都没有就按用户消息序号计数。
 * 这样块与块的边界只取决于用户消息序列，跨刷新稳定，也不再依赖位置启发。
 */

window.__ModuleLoader__.load({
  id: "dsh-turn-hider",
  factory() {
    "use strict";

    const NS = "dsh-turn-hider";
    const STORE_KEY = NS + ":hidden:v1";
    const HIDDEN_ATTR = "data-dth-hidden";
    const TURN_ATTR = "data-dth-turn";
    const TRASH_ATTR = "data-dth-trash-btn";
    const SEAT_ATTR = "data-chat-flow-key";

    const TRASH_SVG =
      "<svg width=\"16\" height=\"16\" viewBox=\"0 0 20 20\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">" +
      "<path d=\"M7 3.2h6M4.2 5.4h11.6M8.1 8.2v5.4M11.9 8.2v5.4M5.6 5.4l.75 9.1a1.6 1.6 0 0 0 1.6 1.5h4.1a1.6 1.6 0 0 0 1.6-1.5l.75-9.1\" " +
      "stroke=\"currentColor\" stroke-width=\"1.25\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>";

    const CSS = [
      "#dsh-turn-hider-root{position:fixed;inset:auto;z-index:2147483000;font:13px/1.5 -apple-system,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif}",
      ".dth-chip{position:fixed;right:18px;top:64px;z-index:2147483000;display:none;align-items:center;gap:6px;padding:6px 12px;border-radius:999px;border:1px solid rgba(127,127,127,.3);background:var(--dsw-alias-bg-layer-2,#1b1d21);color:var(--dsw-alias-label-secondary,#a8adb7);font:inherit;font-size:12px;line-height:18px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.22)}",
      ".dth-chip:hover{color:var(--dsw-alias-label-primary,#e6e6e6)}",
      ".dth-panel{position:fixed;right:18px;top:104px;width:350px;max-width:calc(100vw - 36px);max-height:min(62vh,560px);display:none;flex-direction:column;border-radius:14px;border:1px solid rgba(127,127,127,.28);background:var(--dsw-alias-bg-layer-1,#f7f8fa);color:var(--dsw-alias-label-primary,#e6e6e6);box-shadow:0 10px 34px rgba(0,0,0,.3);overflow:hidden}",
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
      ".dth-trash{cursor:pointer}",
      "[" + HIDDEN_ATTR + "='1']{display:none !important}",
    ].join("\n");

    // ---------- 状态 ----------
    let uiSession = null;
    let rootEl = null, chipEl = null, panelEl = null, panelListEl = null;
    let panelRestoreAllBtn = null, toastEl = null, toastUndoBtn = null;
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

    // ---------- DOM 结构 ----------
    function seatRowOf(el) {
      return el && el.closest ? el.closest("[" + SEAT_ATTR + "]") : null;
    }
    function flowContainer() {
      const clockRow = document.querySelector("div[data-clock]");
      const seat = seatRowOf(clockRow);
      if (seat && seat.parentElement) return seat.parentElement;
      const anySeat = document.querySelector("[" + SEAT_ATTR + "]");
      if (anySeat && anySeat.parentElement) return anySeat.parentElement;
      const group = document.querySelector("[data-chat-turn]");
      return group ? group.parentElement : null;
    }
    function toTurn(value) {
      const n = Number(value);
      return Number.isFinite(n) && n >= 0 ? n : null;
    }
    function directTurn(row) {
      if (row.hasAttribute("data-chat-turn")) return toTurn(row.getAttribute("data-chat-turn"));
      if (row.hasAttribute("data-turn-tail")) return toTurn(row.getAttribute("data-turn-tail"));
      if (row.hasAttribute("data-turn-process")) return toTurn(row.getAttribute("data-turn-process"));
      const inner = row.querySelector("[data-chat-turn],[data-turn-tail],[data-turn-process]");
      if (inner) {
        const t = toTurn(inner.getAttribute("data-chat-turn") || inner.getAttribute("data-turn-tail") || inner.getAttribute("data-turn-process"));
        if (t !== null) return t;
      }
      return null;
    }
    function fiberTurn(row) {
      try {
        const fk = Object.keys(row).find(function (k) { return k.indexOf("__reactFiber$") === 0; });
        if (!fk) return null;
        let fiber = row[fk];
        let depth = 0;
        while (fiber && depth < 40) {
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
      } catch (e) { /* fiber 不可用时按用户消息序号 */ }
      return null;
    }
    function isUserRow(row) {
      return !!row.querySelector("div[data-clock='start']");
    }

    /**
     * 把流行切成轮次块：一条用户消息开一块，到下一条用户消息之前为止；
     * 首条用户消息之前的行归入第一块，最后一块吃到结尾。
     * 每块的轮号：块内直接标记 > 块内用户行的 fiber > 用户消息序号。
     */
    function analyze() {
      const container = flowContainer();
      if (!container) return null;
      const rows = [];
      for (const el of container.children) {
        if (el && el.nodeType === 1 && el.hasAttribute(SEAT_ATTR)) rows.push(el);
      }
      if (!rows.length) return null;
      const userFlags = rows.map(isUserRow);
      let ordinal = 0;
      const blocks = [];
      let current = null;
      const preFirst = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (userFlags[i]) {
          ordinal += 1;
          let turn = directTurn(row);
          if (turn === null) turn = fiberTurn(row);
          if (turn === null) turn = ordinal;
          current = { turn: turn, rows: [row] };
          blocks.push(current);
          continue;
        }
        if (current) current.rows.push(row);
        else preFirst.push(row);
      }
      if (blocks.length && preFirst.length) {
        const first = blocks[0];
        first.rows = preFirst.concat(first.rows);
      }
      for (const block of blocks) {
        if (block.turn === null) continue;
        let direct = null;
        for (const row of block.rows) {
          direct = directTurn(row);
          if (direct !== null) break;
        }
        if (direct !== null && direct !== block.turn) block.turn = direct;
      }
      return { container: container, blocks: blocks };
    }

    // ---------- 扫描、隐藏、注入垃圾桶 ----------
    function scanAndApply() {
      const view = analyze();
      if (!view) { updateChip(); return; }
      const hidden = hiddenMap(sessionId());
      for (const block of view.blocks) {
        const want = hidden[String(block.turn)] ? "1" : null;
        for (const row of block.rows) {
          if (row.getAttribute(TURN_ATTR) !== String(block.turn)) row.setAttribute(TURN_ATTR, String(block.turn));
          if (want) {
            if (row.getAttribute(HIDDEN_ATTR) !== "1") row.setAttribute(HIDDEN_ATTR, "1");
          } else if (row.getAttribute(HIDDEN_ATTR) === "1") {
            row.removeAttribute(HIDDEN_ATTR);
          }
        }
      }
      injectTrashButtons();
      updateChip();
    }
    function injectTrashButtons() {
      const actionRows = document.querySelectorAll("div[data-clock]");
      for (const actions of actionRows) {
        if (actions.querySelector("[" + TRASH_ATTR + "]")) continue;
        const host = actions.closest("[" + TURN_ATTR + "]");
        if (!host || host.getAttribute(HIDDEN_ATTR) === "1") continue;
        const turn = toTurn(host.getAttribute(TURN_ATTR));
        if (turn === null) continue;
        const button = buildTrashButton(turn);
        const clock = actions.getAttribute("data-clock");
        if (clock === "end") {
          const endInfo = actions.lastElementChild;
          if (endInfo && endInfo !== button && endInfo.tagName === "SPAN") {
            const timeEl = findTimeElement(endInfo);
            if (timeEl) endInfo.insertBefore(button, timeEl);
            else endInfo.appendChild(button);
          } else {
            actions.appendChild(button);
          }
        } else {
          actions.appendChild(button);
        }
      }
    }
    function findTimeElement(endInfo) {
      for (const child of endInfo.children) {
        const text = (child.textContent || "").trim();
        if (/^\d{1,2}[:：]/.test(text)) return child;
      }
      return null;
    }
    function buildTrashButton(turn) {
      let button = null;
      const sample = document.querySelector("div[data-clock] button");
      if (sample) {
        button = sample.cloneNode(false);
        while (button.firstChild) button.removeChild(button.firstChild);
        button.removeAttribute("aria-label");
        button.removeAttribute("aria-describedby");
        button.removeAttribute("data-unavailable");
        button.removeAttribute("id");
      } else {
        button = document.createElement("button");
      }
      button.type = "button";
      button.setAttribute(TRASH_ATTR, "1");
      button.setAttribute("aria-label", "隐藏此轮");
      button.setAttribute("title", "隐藏此轮（仅显示层，可恢复）");
      button.classList.add("dth-trash");
      button.innerHTML = TRASH_SVG;
      button.__dthTurn = turn;
      button.addEventListener("click", function (ev) {
        ev.stopPropagation();
        ev.preventDefault();
        const t = button.__dthTurn;
        if (t !== null && t !== undefined) hideTurn(t);
      });
      return button;
    }
    function membersOf(turn) {
      const view = analyze();
      if (!view) return [];
      for (const block of view.blocks) {
        if (block.turn === turn) return block.rows;
      }
      return [];
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
      if (inChat) layoutChrome();
    }

    /**
     * 徽标贴聊天区右上角：以聊天容器（seat 列表的父级）顶缘为锚，
     * 工具栏下缘 + 10px —— 桌面端带标题栏、浏览器端不带，都能自动避开；
     * 探测失败时退回静态 64px 兜底。窗口变化由 resize 监听与 1.5s interval 重算。
     */
    function layoutChrome() {
      if (!chipEl) return;
      let top = 64; // DOM 探测失败时的静态兜底：典型标题栏 + 工具栏以下
      try {
        const view = flowContainer();
        if (view) {
          const rect = view.getBoundingClientRect();
          if (rect && rect.height > 0 && rect.top >= 0) top = Math.max(12, Math.round(rect.top) + 10);
        }
      } catch (e) { /* 布局探测失败保持兜底值 */ }
      chipEl.style.top = top + "px";
      if (panelEl) panelEl.style.top = (top + 40) + "px"; // 徽标高约 30px + 10px 间距
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
        const empty = el("div", "dth-empty", "这个会话还没有隐藏任何轮次。点消息图标行末尾的垃圾桶按钮即可隐藏该轮。");
        panelListEl.appendChild(empty);
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

        const onResize = function () { try { updateChip(); } catch (e) { /* 忽略 */ } };
        window.addEventListener("resize", onResize);
        try { scanAndApply(); } catch (e) { /* 首扫时页面可能还没有聊天区 */ }

        const timer = window.setInterval(function () {
          try { updateChip(); if (panelOpen) renderPanel(); } catch (e) { /* 忽略单次刷新失败 */ }
        }, 1500);

        ctx.effect(function () {
          return function () {
            observer.disconnect();
            window.removeEventListener("resize", onResize);
            window.clearInterval(timer);
            try { rootEl.remove(); } catch (e) { /* 已被移除 */ }
            try { style.remove(); } catch (e) { /* 已被移除 */ }
            window.__DSH_TURN_HIDER__ = false;
          };
        }, "dsh-turn-hider: ui");
      },
    };
  },
});
