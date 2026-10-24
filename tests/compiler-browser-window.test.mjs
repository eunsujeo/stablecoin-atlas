import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unexpectedBrowserTarget, confirmVisibleBrowserWindow } from '../tools/research/compiler-browser-window.mjs';

test('the manually attached initial tab stays open while unexpected child targets are rejected', () => {
  const closed = [];
  for (const target of ['initial-tab', 'popup-tab', 'worker-target']) {
    if (unexpectedBrowserTarget(target, 'initial-tab')) closed.push(target);
  }
  assert.deepEqual(closed, ['popup-tab', 'worker-target']);
  assert(unexpectedBrowserTarget(undefined, undefined));
  assert(unexpectedBrowserTarget('initial-tab', undefined));
  assert(unexpectedBrowserTarget('', ''));
});

test('window readiness is bounded and verifies normal visible dimensions without resetting a request budget', async () => {
  let attempts = 0, pauses = 0;
  const methods = [];
  const send = async (method, params) => {
    methods.push(method);
    if (method === 'Browser.getWindowForTarget') {
      assert.equal(params.targetId, 'initial-tab');
      if (++attempts < 3) throw new Error('WINDOW_STARTING');
      return { windowId: 0, bounds: { windowState: 'normal' } };
    }
    assert.equal(params.windowId, 0);
    return { bounds: { windowState: 'normal', width: 1000, height: 760 } };
  };
  assert.equal((await confirmVisibleBrowserWindow(send, 'initial-tab', async () => { pauses++; })).width, 1000);
  assert.equal(attempts, 3); assert.equal(pauses, 2);
  assert(!methods.includes('Browser.setWindowBounds'));
  assert(!methods.some(m => /navigate|request|fetch/i.test(m)));

  for (const reply of [undefined, { bounds: {} }, { windowId: -1, bounds: {} }]) {
    let calls = 0;
    await assert.rejects(confirmVisibleBrowserWindow(async () => { calls++; return reply; }, 'initial-tab', async () => {}), /VISIBLE_WINDOW_NOT_AVAILABLE/);
    assert.equal(calls, 20);
  }
  let restored = false;
  const restoredWindow = await confirmVisibleBrowserWindow(async method => {
    if (method === 'Browser.getWindowForTarget') return { windowId: 1, bounds: { windowState: 'minimized' } };
    if (method === 'Browser.setWindowBounds') { restored = true; return {}; }
    return { bounds: { windowState: 'normal', width: 1, height: 1 } };
  }, 'initial-tab', async () => {});
  assert(restored); assert.equal(restoredWindow.windowState, 'normal');
  for (const bounds of [{ windowState: 'minimized', width: 1, height: 1 }, { windowState: 'normal', width: 0, height: 1 }]) {
    await assert.rejects(confirmVisibleBrowserWindow(async method => method === 'Browser.getWindowForTarget'
      ? { windowId: 1, bounds: { windowState: 'normal' } } : { bounds }, 'initial-tab', async () => {}), /VISIBLE_WINDOW_NOT_CONFIRMED/);
  }
});
