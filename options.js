document.addEventListener('DOMContentLoaded', init);

let shortcuts = [];
let editingIndex = -1;

async function init() {
  await applyTheme();
  shortcuts = await getShortcuts();
  renderShortcuts();
  setupEventListeners();
  setupThemeToggle();
}

async function applyTheme() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ theme: 'dark' }, (result) => {
      document.body.setAttribute('data-theme', result.theme);
      updateThemeButtons(result.theme);
      resolve();
    });
  });
}

function updateThemeButtons(theme) {
  document.querySelectorAll('.theme-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
}

function setupThemeToggle() {
  document.querySelectorAll('.theme-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const theme = btn.dataset.theme;
      document.body.setAttribute('data-theme', theme);
      updateThemeButtons(theme);
      await chrome.storage.sync.set({ theme });
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

async function saveShortcuts() {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ shortcuts }, resolve);
  });
}

function renderShortcuts() {
  const listEl = document.getElementById('shortcuts-list');
  const emptyEl = document.getElementById('empty-state');

  if (shortcuts.length === 0) {
    listEl.style.display = 'none';
    emptyEl.style.display = 'block';
    return;
  }

  listEl.style.display = 'flex';
  emptyEl.style.display = 'none';
  listEl.innerHTML = '';

  shortcuts.forEach((shortcut, index) => {
    const item = document.createElement('div');
    item.className = 'shortcut-item';
    item.innerHTML = `
      <div class="shortcut-info">
        <span class="key">${shortcut.key.toUpperCase()}</span>
        <div class="details">
          <span class="name">${escapeHtml(shortcut.name)}</span>
          <span class="url">${escapeHtml(shortcut.url)}</span>
        </div>
      </div>
      <div class="shortcut-actions">
        <button class="btn-icon edit-btn" data-index="${index}" title="Edit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button class="btn-icon delete-btn" data-index="${index}" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;
    listEl.appendChild(item);
  });

  // Attach event listeners to buttons
  document.querySelectorAll('.edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => openEditModal(parseInt(btn.dataset.index)));
  });

  document.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteShortcut(parseInt(btn.dataset.index)));
  });
}

function setupEventListeners() {
  document.getElementById('add-shortcut').addEventListener('click', openAddModal);
  document.getElementById('cancel-btn').addEventListener('click', closeModal);
  document.querySelector('.modal-backdrop').addEventListener('click', closeModal);
  document.getElementById('shortcut-form').addEventListener('submit', handleFormSubmit);

  // Validate key input - only allow single alphanumeric characters
  document.getElementById('shortcut-key').addEventListener('input', (e) => {
    const value = e.target.value;
    if (value.length > 0) {
      const lastChar = value[value.length - 1];
      if (/^[a-zA-Z0-9]$/.test(lastChar)) {
        e.target.value = lastChar.toLowerCase();
      } else {
        e.target.value = value.slice(0, -1);
      }
    }
  });
}

function openAddModal() {
  editingIndex = -1;
  document.getElementById('modal-title').textContent = 'Add Shortcut';
  document.getElementById('shortcut-key').value = '';
  document.getElementById('shortcut-name').value = '';
  document.getElementById('shortcut-url').value = '';
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('shortcut-key').focus();
}

function openEditModal(index) {
  editingIndex = index;
  const shortcut = shortcuts[index];
  document.getElementById('modal-title').textContent = 'Edit Shortcut';
  document.getElementById('shortcut-key').value = shortcut.key;
  document.getElementById('shortcut-name').value = shortcut.name;
  document.getElementById('shortcut-url').value = shortcut.url;
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('shortcut-key').focus();
}

function closeModal() {
  document.getElementById('modal').style.display = 'none';
  editingIndex = -1;
}

async function handleFormSubmit(e) {
  e.preventDefault();

  const key = document.getElementById('shortcut-key').value.toLowerCase();
  const name = document.getElementById('shortcut-name').value.trim();
  const url = document.getElementById('shortcut-url').value.trim();

  // Validate key is not already used
  const existingIndex = shortcuts.findIndex((s) => s.key.toLowerCase() === key);
  if (existingIndex !== -1 && existingIndex !== editingIndex) {
    alert(`Key "${key.toUpperCase()}" is already assigned to "${shortcuts[existingIndex].name}"`);
    return;
  }

  const shortcutData = { key, name, url };

  if (editingIndex === -1) {
    shortcuts.push(shortcutData);
  } else {
    shortcuts[editingIndex] = shortcutData;
  }

  await saveShortcuts();
  renderShortcuts();
  closeModal();
}

async function deleteShortcut(index) {
  const shortcut = shortcuts[index];
  if (confirm(`Delete shortcut "${shortcut.name}" (${shortcut.key.toUpperCase()})?`)) {
    shortcuts.splice(index, 1);
    await saveShortcuts();
    renderShortcuts();
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
