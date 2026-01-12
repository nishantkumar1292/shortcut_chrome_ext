document.addEventListener('DOMContentLoaded', init);

async function init() {
  await applyTheme();
  const shortcuts = await getShortcuts();
  renderShortcuts(shortcuts);
  setupKeyboardListener(shortcuts);
  setupSettingsButton();
}

async function applyTheme() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ theme: 'dark' }, (result) => {
      document.body.setAttribute('data-theme', result.theme);
      resolve();
    });
  });
}

async function getShortcuts() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ shortcuts: [] }, (result) => {
      resolve(result.shortcuts);
    });
  });
}

function renderShortcuts(shortcuts) {
  const listEl = document.getElementById('shortcuts-list');
  const emptyEl = document.getElementById('empty-state');

  if (shortcuts.length === 0) {
    listEl.style.display = 'none';
    emptyEl.style.display = 'flex';
    document.getElementById('open-options').addEventListener('click', openOptions);
    return;
  }

  listEl.innerHTML = '';
  emptyEl.style.display = 'none';

  shortcuts.forEach((shortcut) => {
    const item = document.createElement('div');
    item.className = 'shortcut-item';
    item.innerHTML = `
      <span class="key">${shortcut.key.toUpperCase()}</span>
      <span class="name">${escapeHtml(shortcut.name)}</span>
    `;
    item.addEventListener('click', () => navigateToUrl(shortcut.url));
    listEl.appendChild(item);
  });
}

function setupKeyboardListener(shortcuts) {
  document.addEventListener('keydown', (e) => {
    // Ignore modifier keys alone
    if (e.key === 'Control' || e.key === 'Alt' || e.key === 'Shift' || e.key === 'Meta') {
      return;
    }

    // Ignore if any modifier is pressed (except shift for uppercase)
    if (e.ctrlKey || e.altKey || e.metaKey) {
      return;
    }

    const key = e.key.toLowerCase();
    const shortcut = shortcuts.find((s) => s.key.toLowerCase() === key);

    if (shortcut) {
      e.preventDefault();
      navigateToUrl(shortcut.url);
    }
  });
}

function navigateToUrl(url) {
  // Ensure URL has protocol
  let finalUrl = url;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    finalUrl = 'https://' + url;
  }

  // Open in new tab and make it active
  chrome.tabs.create({ url: finalUrl, active: true });

  window.close();
}

function setupSettingsButton() {
  document.getElementById('settings-btn').addEventListener('click', openOptions);
}

function openOptions() {
  chrome.runtime.openOptionsPage();
  window.close();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
