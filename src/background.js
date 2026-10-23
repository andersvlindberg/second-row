// Second Row: background service worker.
// Owns the bookmarks API (content scripts cannot read bookmarks) and settings defaults.

const DEFAULTS = {
  folderId: null,          // set on install to a folder called "Second Row"
  style: 'full',           // 'full' | 'compact' | 'icons'
  theme: 'auto',           // 'auto' | 'light' | 'dark'
  layout: 'push',          // 'push' moves the page down; 'overlay' floats above it
  visible: true,
  openInNewTab: false
};
const FOLDER_TITLE = 'Second Row';

async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  return { ...DEFAULTS, ...stored };
}

async function ensureFolder() {
  const s = await getSettings();
  if (s.folderId) {
    try { await chrome.bookmarks.get(s.folderId); return s.folderId; } catch { /* folder was deleted */ }
  }
  const found = (await chrome.bookmarks.search({ title: FOLDER_TITLE })).find(n => !n.url);
  const folder = found || await chrome.bookmarks.create({ parentId: '2', title: FOLDER_TITLE }); // '2' = Other bookmarks
  await chrome.storage.sync.set({ folderId: folder.id });
  return folder.id;
}

async function getItems() {
  const folderId = await ensureFolder();
  const children = await chrome.bookmarks.getChildren(folderId);
  // Bookmarks and one level of sub-folders (shown as a menu)
  return Promise.all(children.map(async c => c.url
    ? { type: 'link', id: c.id, title: c.title, url: c.url }
    : { type: 'folder', id: c.id, title: c.title, items: (await chrome.bookmarks.getChildren(c.id)).filter(x => x.url).map(x => ({ title: x.title, url: x.url })) }));
}

async function broadcast() {
  const tabs = await chrome.tabs.query({});
  for (const t of tabs) chrome.tabs.sendMessage(t.id, { type: 'refresh' }).catch(() => {});
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await ensureFolder();
  if (reason === 'install') chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (msg.type === 'getBar') {
    Promise.all([getSettings(), getItems()]).then(([settings, items]) => reply({ settings, items }));
    return true;
  }
  if (msg.type === 'open') {
    if (msg.newTab || msg.background) chrome.tabs.create({ url: msg.url, active: !msg.background, index: sender.tab ? sender.tab.index + 1 : undefined });
    else if (sender.tab) chrome.tabs.update(sender.tab.id, { url: msg.url });
  }
  if (msg.type === 'openOptions') chrome.runtime.openOptionsPage();
});

for (const ev of ['onCreated', 'onRemoved', 'onChanged', 'onMoved', 'onChildrenReordered']) {
  chrome.bookmarks[ev].addListener(broadcast);
}
chrome.storage.onChanged.addListener(broadcast);

chrome.commands.onCommand.addListener(async cmd => {
  if (cmd !== 'toggle-bar') return;
  const { visible } = await getSettings();
  await chrome.storage.sync.set({ visible: !visible });
});

chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
