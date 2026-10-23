const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), os = require('os');
(async () => {
  const ext = path.join(__dirname, 'src');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sbb-'));
  const ctx = await chromium.launchPersistentContext(dir, { headless: false, args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`], viewport: { width: 1100, height: 420 } });
  let sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
  await new Promise(r => setTimeout(r, 1500));
  const errs = [];
  // seed bookmarks
  await sw.evaluate(async () => {
    const { folderId } = await chrome.storage.sync.get('folderId');
    const add = (title, url, parentId = folderId) => chrome.bookmarks.create({ parentId, title, url });
    for (const [t, u] of [['Gmail','https://mail.google.com'],['GitHub','https://github.com'],['dbt docs','https://docs.getdbt.com'],['Snowflake','https://app.snowflake.com'],['GA4','https://analytics.google.com'],['Claude','https://claude.ai']]) await add(t, u);
    const f = await chrome.bookmarks.create({ parentId: folderId, title: 'Skola' });
    await add('IHM', 'https://ihm.se', f.id); await add('Canvas', 'https://canvas.instructure.com', f.id);
  });
  for (const style of ['full','compact','icons']) {
    await sw.evaluate(s => chrome.storage.sync.set({ style: s }), style);
    const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
    await p.goto('http://localhost:8765/');
    await p.waitForTimeout(1500);
    await p.screenshot({ path: path.join(__dirname, 'docs', `style-${style}.png`), clip: { x: 0, y: 0, width: 1100, height: 140 } });
    if (style === 'full') {
      const mt = await p.evaluate(() => getComputedStyle(document.documentElement).marginTop);
      console.log('push margin', mt);
    }
    if (style === 'full') {
      // open the 'Skola' folder menu (closed shadow root, so click by position)
      await p.mouse.click(562, 15);
      await p.waitForTimeout(500);
      await p.screenshot({ path: path.join(__dirname, 'docs', 'menu.png'), clip: { x: 0, y: 0, width: 1100, height: 160 } });
    }
    await p.close();
  }
  const opt = await ctx.newPage();
  const id = sw.url().split('/')[2];
  await opt.setViewportSize({ width: 760, height: 900 });
  await opt.goto(`chrome-extension://${id}/options.html`);
  await opt.waitForTimeout(800);
  await opt.screenshot({ path: path.join(__dirname, 'docs', 'options.png'), fullPage: true });
  console.log('errors', errs);
  await ctx.close();
})();
