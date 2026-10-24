// DGChat iPhone Duo —— 窗口状态判定（纯逻辑，浏览器 / Node 双环境可测）
// 原则：不按设备名称硬编码，只依据真实可用的窗口尺寸与视口环境信息。
// Node 环境：module.exports 导出（供 tests/layout.test.mjs 使用）
// 浏览器环境：挂载到 window.DuoWindowState

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.DuoWindowState = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  // 默认断点（可被 config/duo.config.js 覆盖）
  const DEFAULTS = {
    DUAL_MIN_WIDTH: 760, // 左右双栏的最小窗口宽度：每栏 >= 370px
    PANE_MIN_WIDTH: 320, // 单栏最小可用宽度（低于此视为极窄，仍单栏）
    KEYBOARD_SHRINK_RATIO: 0.82, // 可视高度 < 内部高度 * 该比例 → 判定键盘弹出
  };

  /**
   * 判定当前应使用单栏还是双栏布局。
   * @param {object} env 真实窗口环境
   * @param {number} env.width  视口宽度（CSS 像素）
   * @param {number} env.height 视口高度（CSS 像素）
   * @param {number} [env.visualHeight] visualViewport 高度（键盘弹出时会小于 height）
   * @param {object} [cfg] 断点配置（覆盖默认值）
   * @returns {{mode:'single'|'dual', reason:string, keyboard:boolean}}
   */
  function resolveLayout(env, cfg) {
    const c = Object.assign({}, DEFAULTS, cfg || {});
    const width = Number(env.width) || 0;
    const height = Number(env.height) || 0;
    const keyboard = !!(
      env.visualHeight && height > 0 && env.visualHeight < height * c.KEYBOARD_SHRINK_RATIO
    );

    if (width < c.PANE_MIN_WIDTH) {
      return { mode: 'single', reason: 'width-below-pane-min', keyboard };
    }
    if (width >= c.DUAL_MIN_WIDTH) {
      return { mode: 'dual', reason: 'width-ok', keyboard };
    }
    return { mode: 'single', reason: 'width-between-panes', keyboard };
  }

  /**
   * 尺寸变化时的面板去留决策：
   * 双栏 -> 单栏时，若有选中的详情则先显示详情（用户正在看的内容优先）；
   * 单栏 -> 双栏时，两个面板同时可见。
   * @param {string} prevMode 'single'|'dual'
   * @param {string} nextMode
   * @param {boolean} hasSelection 是否已有选中的会话/动态
   * @returns {{showList:boolean, showDetail:boolean}}
   */
  function paneVisibility(prevMode, nextMode, hasSelection) {
    if (nextMode === 'dual') return { showList: true, showDetail: true };
    // 单栏：有选中内容优先展示详情，否则展示列表
    if (hasSelection) return { showList: false, showDetail: true };
    return { showList: true, showDetail: false };
  }

  /**
   * 方向归类（真实窗口比例，不读设备型号）。
   */
  function orientation(width, height) {
    if (!width || !height) return 'unknown';
    return width > height ? 'landscape' : width === height ? 'square' : 'portrait';
  }

  return { DEFAULTS, resolveLayout, paneVisibility, orientation };
});
