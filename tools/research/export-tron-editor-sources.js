// Run only in the original TRONSCAN USDT Code page's browser console.
// Reads existing Solidity editor models; downloads local JSON. Makes no requests.
(() => {
  'use strict';
  const contract = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
  const fail = message => { throw new Error(`TRON source export: ${message}`); };
  const page = new URL(globalThis.location.href);
  const modern = page.pathname === `/contract/${contract}/code` || page.pathname === `/contract/${contract}/code/`;
  const legacy = page.pathname === '/' && (page.hash === `#/contract/${contract}/code` || page.hash === `#/contract/${contract}/code/`);
  if (page.origin !== 'https://tronscan.org' || page.username || page.password || !(modern || legacy)) fail('open the exact HTTPS TRONSCAN USDT Code page.');
  const api = globalThis.monaco?.editor;
  if (typeof api?.getModels !== 'function') fail('existing global Monaco API is unavailable; nothing was exported.');
  const labels = Array.from(document.querySelectorAll('[class*="codeTitleName"]'), node => {
    const match = /^File (\d+) \(of 10\): ([A-Za-z0-9_.-]+\.sol)$/.exec(node.textContent.trim());
    if (!match) fail('unexpected file labels.');
    return match[2];
  });
  if (labels.length !== 10 || new Set(labels).size !== 10) fail('expected ten unique current-page file labels.');
  let all;
  try { all = api.getModels(); } catch { fail('editor models could not be read.'); }
  if (!Array.isArray(all) || all.length > 100) fail('invalid or excessive model list.');
  const models = []; const contents = new Set(); const names = new Set(); let total = 0;
  for (const model of all) {
    let language;
    try { language = model.getLanguageId(); } catch { fail('model language could not be read.'); }
    if (!['sol', 'solidity'].includes(language)) continue;
    let content;
    try { content = model.getValue(); } catch { fail('Solidity model could not be read.'); }
    if (typeof content !== 'string' || !content.trim()) fail('empty Solidity model.');
    const bytes = new TextEncoder().encode(content).length; total += bytes;
    if (bytes > 512 * 1024 || total > 5 * 1024 * 1024 || contents.has(content)) fail('oversized or duplicate Solidity model.');
    contents.add(content);
    if (!/\bpragma\s+solidity\b/.test(content)) fail('Solidity pragma missing.');
    const candidate = typeof model.uri?.path === 'string' ? model.uri.path.split('/').pop() : null;
    const fileNameClaim = labels.includes(candidate) ? candidate : null;
    if (fileNameClaim && names.has(fileNameClaim)) fail('duplicate model filename claim.');
    if (fileNameClaim) names.add(fileNameClaim);
    models.push({ modelIndex: models.length, language, fileNameClaim, content });
  }
  if (models.length !== 10) fail('expected exactly ten Solidity models; lazy/stale/missing models must be checked.');
  const roots = models.filter(model => /\bcontract\s+TetherToken\b/.test(model.content));
  if (roots.length !== 1 || !/\bfunction\s+transfer\s*\(/.test(roots[0].content) || !/\bfunction\s+approve\s*\(/.test(roots[0].content)) fail('full-looking TetherToken model missing.');
  const payload = { kind: 'USER_BROWSER_MONACO_SOURCE_EXPORT', claimedContract: contract, capturedAt: new Date().toISOString(),
    displayedFileLabels: labels, modelToFileAssociation: 'UNVERIFIED_CANDIDATES_ONLY', sourceCompleteness: 'REQUIRES_LOCAL_REVIEW', models };
  const blob = new Blob([JSON.stringify(payload, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob); let anchor;
  try { anchor = document.createElement('a'); anchor.href = url; anchor.download = 'tron-usdt-editor-sources.json'; anchor.click(); }
  finally { try { anchor?.remove(); } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); } }
  console.info('Local source JSON download requested: 10 models. No network requests made by this helper.');
})();
