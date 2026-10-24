// Local CDP preparation helpers. These never launch a browser or send HTTP requests.
export function unexpectedBrowserTarget(targetId, expectedTargetId) {
  return typeof targetId !== 'string' || typeof expectedTargetId !== 'string'
    || !targetId || !expectedTargetId || targetId !== expectedTargetId;
}

export async function confirmVisibleBrowserWindow(send, targetId,
  pause = () => new Promise(resolve => setTimeout(resolve, 50))) {
  let window;
  for (let attempts = 0; attempts < 20; attempts++) {
    try {
      const candidate = await send('Browser.getWindowForTarget', { targetId });
      if (!candidate?.bounds || !Number.isInteger(candidate.windowId) || candidate.windowId < 0) throw new Error('WINDOW_NOT_READY');
      window = candidate;
      break;
    } catch { await pause(); }
  }
  if (!window) throw new Error('VISIBLE_WINDOW_NOT_AVAILABLE');
  if (window.bounds.windowState !== 'normal') {
    await send('Browser.setWindowBounds', { windowId: window.windowId, bounds: { windowState: 'normal' } });
  }
  const result = (await send('Browser.getWindowBounds', { windowId: window.windowId })).bounds;
  if (result?.windowState !== 'normal' || !(result.width > 0 && result.height > 0)) {
    throw new Error('VISIBLE_WINDOW_NOT_CONFIRMED');
  }
  return result;
}
