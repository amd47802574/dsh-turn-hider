/**
 * dsh-turn-hider — Host half（挂载锚点）。
 *
 * 本插件的能力全部在浏览器端（client.js）：隐藏聊天记录里的任意一轮、
 * 记住隐藏清单、随时恢复。宿主侧没有任何逻辑要跑 —— 这里只提供一个
 * 可挂载的空服务，让 bundle 层的 cordis.patch.yml insert 行有归属，
 * 并在宿主日志里留一条挂载记录，方便确认插件确实被加载。
 *
 * @module dsh-turn-hider
 */

/** Cordis 插件名，用于 Loader 诊断日志。 */
export const name = "turn-hider";

/** 无宿主依赖：client-only 插件。 */
export const inject = [];

/**
 * @param ctx - 插件上下文。
 */
export function apply(ctx) {
  try {
    const logger = ctx.logger ? ctx.logger("turn-hider") : null;
    if (logger && typeof logger.info === "function") {
      logger.info("mounted — 轮次隐藏能力在浏览器端生效（client-only）");
    }
  } catch {
    // 日志通道不可用不影响挂载。
  }
}
