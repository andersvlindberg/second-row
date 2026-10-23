const DEFAULTS = { folderId: null, style: 'full', theme: 'auto', layout: 'push', visible: true, openInNewTab: false };
const $ = id => document.getElementById(id);

async function folders() {
  const [tree] = await chrome.bookmarks.getTree();
  const out = [];
  (function walk(node, depth) {
    for (const c of node.children || []) {
      if (c.url) continue;
      out.push({ id: c.id, title: c.title || '(untitled)', depth });
      walk(c, depth + 1);
    }
  })(tree, 0);
  return out;
}

let timer;
function saved() {
  $('saved').textContent = 'Saved';
  clearTimeout(timer);
  timer = setTimeout(() => { $('saved').textContent = ''; }, 1500);
}
const save = patch => chrome.storage.sync.set(patch).then(saved);

(async () => {
  const s = { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };
  for (const f of await folders()) {
    const o = document.createElement('option');
    o.value = f.id;
    o.textContent = `${' '.repeat(f.depth)}${f.title}`;
    $('folder').append(o);
  }
  if (s.folderId) $('folder').value = s.folderId;
  document.querySelector(`input[name=style][value=${s.style}]`).checked = true;
  $('theme').value = s.theme;
  $('layout').value = s.layout;
  $('newtab').checked = s.openInNewTab;
  $('visible').checked = s.visible;

  $('folder').addEventListener('change', e => save({ folderId: e.target.value }));
  document.querySelectorAll('input[name=style]').forEach(r => r.addEventListener('change', e => save({ style: e.target.value })));
  $('theme').addEventListener('change', e => save({ theme: e.target.value }));
  $('layout').addEventListener('change', e => save({ layout: e.target.value }));
  $('newtab').addEventListener('change', e => save({ openInNewTab: e.target.checked }));
  $('visible').addEventListener('change', e => save({ visible: e.target.checked }));
})();
