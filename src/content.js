// Second Row: draws the bar inside a closed Shadow DOM so page CSS can't touch it,
// and the bar's CSS can't leak into the page.
(() => {
  if (window.top !== window || document.documentElement.dataset.secondRow) return;
  document.documentElement.dataset.secondRow = '1';

  const HEIGHTS = { full: 32, compact: 26, icons: 30 };
  const host = document.createElement('second-row');
  host.style.cssText = 'all:initial;position:fixed;top:0;left:0;right:0;z-index:2147483647;display:block;';
  const root = host.attachShadow({ mode: 'closed' });
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('bar.css');
  const bar = document.createElement('nav');
  bar.setAttribute('aria-label', 'Second bookmarks row');
  const menus = document.createElement('div');
  menus.className = 'menus';
  root.append(link, bar, menus);
  const closeMenus = () => { menus.querySelectorAll('.menu').forEach(m => { m.hidden = true; }); bar.querySelectorAll('[aria-expanded]').forEach(b => b.setAttribute('aria-expanded', 'false')); };

  let pushStyle = null;
  const favicon = url => chrome.runtime.getURL(`/_favicon/?pageUrl=${encodeURIComponent(url)}&size=32`);

  function setPush(px) {
    if (!pushStyle) { pushStyle = document.createElement('style'); pushStyle.dataset.secondRow = ''; }
    pushStyle.textContent = px ? `html{margin-top:${px}px !important;}` : '';
    (document.head || document.documentElement).appendChild(pushStyle);
  }

  function open(url, e) {
    e.preventDefault();
    const newTab = e.ctrlKey || e.metaKey || e.button === 1 || bar.dataset.newtab === '1';
    chrome.runtime.sendMessage({ type: 'open', url, newTab, background: e.button === 1 || ((e.ctrlKey || e.metaKey) && !e.shiftKey) });
  }

  function item({ title, url }) {
    const a = document.createElement('a');
    a.className = 'item';
    a.href = url;
    a.title = title ? `${title}\n${url}` : url;
    const img = document.createElement('img');
    img.src = favicon(url); img.alt = ''; img.width = 16; img.height = 16;
    const span = document.createElement('span');
    span.className = 'label';
    span.textContent = title || new URL(url).hostname;
    a.append(img, span);
    a.addEventListener('click', e => open(url, e));
    a.addEventListener('auxclick', e => { if (e.button === 1) open(url, e); });
    return a;
  }

  function folder(f) {
    const wrap = document.createElement('div');
    wrap.className = 'folder';
    const btn = document.createElement('button');
    btn.className = 'item';
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    btn.innerHTML = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M1.5 3.5h5l1.5 1.5h6.5v8h-13z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>';
    const span = document.createElement('span'); span.className = 'label'; span.textContent = f.title;
    btn.append(span);
    const menu = document.createElement('div');
    menu.className = 'menu'; menu.hidden = true; menu.setAttribute('role', 'menu');
    f.items.forEach(i => menu.append(item(i)));
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const opening = menu.hidden;
      closeMenus();
      if (!opening) return;
      const r = btn.getBoundingClientRect();
      menu.style.top = `${r.bottom + 4}px`;
      menu.style.left = `${Math.min(r.left, window.innerWidth - 220)}px`;
      menu.hidden = false; btn.setAttribute('aria-expanded', 'true');
    });
    menus.append(menu);
    wrap.append(btn);
    return wrap;
  }

  function render({ settings, items }) {
    bar.className = `bar style-${settings.style} theme-${settings.theme}`;
    bar.dataset.newtab = settings.openInNewTab ? '1' : '0';
    bar.replaceChildren(); menus.replaceChildren();
    menus.className = `menus style-${settings.style} theme-${settings.theme}`;
    if (!items.length) {
      const empty = document.createElement('button');
      empty.className = 'empty';
      empty.textContent = 'Second Row is empty. Add bookmarks to the “Second Row” folder, or choose a folder in settings.';
      empty.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'openOptions' }));
      bar.append(empty);
    } else {
      items.forEach(i => bar.append(i.type === 'folder' ? folder(i) : item(i)));
    }
    host.hidden = !settings.visible;
    setPush(settings.visible && settings.layout === 'push' ? HEIGHTS[settings.style] || 32 : 0);
  }

  function load() {
    chrome.runtime.sendMessage({ type: 'getBar' }, res => { if (res) render(res); });
  }

  document.addEventListener('click', closeMenus);
  window.addEventListener('blur', closeMenus);
  chrome.runtime.onMessage.addListener(msg => { if (msg.type === 'refresh') load(); });

  const mount = () => { document.documentElement.appendChild(host); load(); };
  if (document.documentElement) mount(); else document.addEventListener('DOMContentLoaded', mount);
})();
