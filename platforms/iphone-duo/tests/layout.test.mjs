// DGChat iPhone Duo —— 布局判定逻辑测试（纯函数，无需浏览器/真机）
// 运行：node --test platforms/iphone-duo/tests/layout.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import duoState from '../src/window-state.js';
const { resolveLayout, paneVisibility, orientation, DEFAULTS } = duoState;

const cfg = { DUAL_MIN_WIDTH: 560, PANE_MIN_WIDTH: 300, KEYBOARD_SHRINK_RATIO: 0.82 };

test('闭合（窄屏）→ 单栏', () => {
  const r = resolveLayout({ width: 414, height: 896 }, cfg); // iPhone 竖屏量级
  assert.equal(r.mode, 'single');
  assert.equal(r.reason, 'width-between-panes');
  assert.equal(r.keyboard, false);
});

test('展开（宽屏）→ 双栏', () => {
  const r = resolveLayout({ width: 900, height: 820 }, cfg); // Duo 展开量级（模拟尺寸）
  assert.equal(r.mode, 'dual');
  assert.equal(r.reason, 'width-ok');
});

test('横屏窄高（如 896×414）→ 仍按宽度判定为双栏', () => {
  const r = resolveLayout({ width: 896, height: 414 }, cfg);
  assert.equal(r.mode, 'dual');
  assert.equal(orientation(896, 414), 'landscape');
});

test('断点边界：560 双栏 / 559 单栏 / 300 以下极窄保护', () => {
  assert.equal(resolveLayout({ width: 560, height: 900 }, cfg).mode, 'dual');
  assert.equal(resolveLayout({ width: 559, height: 900 }, cfg).mode, 'single');
  const tiny = resolveLayout({ width: 299, height: 600 }, cfg);
  assert.equal(tiny.mode, 'single');
  assert.equal(tiny.reason, 'width-below-pane-min');
});

// 真机 CSS 视口（用户提供）：闭合 466×678 / 展开 626×890
test('真机尺寸：闭合 466×678 单栏 / 展开 626×890 双栏 / 闭合横屏 678 宽双栏', () => {
  assert.equal(resolveLayout({ width: 466, height: 678 }, cfg).mode, 'single');
  assert.equal(resolveLayout({ width: 626, height: 890 }, cfg).mode, 'dual');
  assert.equal(resolveLayout({ width: 678, height: 466 }, cfg).mode, 'dual');
});

test('键盘弹出：visualHeight 大幅小于视口高度', () => {
  const r = resolveLayout({ width: 414, height: 896, visualHeight: 500 }, cfg);
  assert.equal(r.keyboard, true);
  assert.equal(r.mode, 'single', '键盘不改变栏式判定，只作标记');
  const r2 = resolveLayout({ width: 900, height: 820, visualHeight: 500 }, cfg);
  assert.equal(r2.mode, 'dual');
  assert.equal(r2.keyboard, true);
});

test('键盘阈值：轻微高度变化不误判', () => {
  assert.equal(resolveLayout({ width: 414, height: 896, visualHeight: 780 }, cfg).keyboard, false);
});

test('面板去留：双栏→单栏保留用户正在看的详情；单栏→双栏两栏同显', () => {
  assert.deepEqual(paneVisibility('dual', 'single', true), { showList: false, showDetail: true });
  assert.deepEqual(paneVisibility('dual', 'single', false), { showList: true, showDetail: false });
  assert.deepEqual(paneVisibility('single', 'dual', true), { showList: true, showDetail: true });
  assert.deepEqual(paneVisibility('single', 'dual', false), { showList: true, showDetail: true });
});

test('非法输入兜底', () => {
  assert.equal(resolveLayout({}, cfg).mode, 'single');
  assert.equal(orientation(0, 0), 'unknown');
});

test('默认配置完整性', () => {
  assert.ok(DEFAULTS.DUAL_MIN_WIDTH >= 700);
  assert.ok(DEFAULTS.PANE_MIN_WIDTH >= 300);
  assert.ok(DEFAULTS.KEYBOARD_SHRINK_RATIO > 0.5 && DEFAULTS.KEYBOARD_SHRINK_RATIO < 1);
});
