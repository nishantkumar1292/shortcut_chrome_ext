document.addEventListener('DOMContentLoaded', init);

let shortcuts = [];
let editingIndex = -1;

let redirectRules = [];
let editingRedirectIndex = -1;

async function init() {
  await applyTheme();
  shortcuts = await getShortcuts();
  redirectRules = await getRedirectRules();
  renderShortcuts();
  renderRedirectRules();
  setupEventListeners();
  setupRedirectEventListeners();
  setupThemeToggle();
}

// ============================================================
// Theme
// ============================================================

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

// ============================================================
// Shortcuts (existing)
// ============================================================

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
  document.querySelector('#modal .modal-backdrop').addEventListener('click', closeModal);
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

// ============================================================
// Redirect Rules (new)
// ============================================================

async function getRedirectRules() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ redirectRules: [] }, (result) => {
      resolve(result.redirectRules);
    });
  });
}

async function saveRedirectRules() {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ redirectRules }, resolve);
  });
}

function renderRedirectRules() {
  const listEl = document.getElementById('redirects-list');
  const emptyEl = document.getElementById('redirects-empty-state');

  if (redirectRules.length === 0) {
    listEl.style.display = 'none';
    emptyEl.style.display = 'block';
    return;
  }

  listEl.style.display = 'flex';
  emptyEl.style.display = 'none';
  listEl.innerHTML = '';

  redirectRules.forEach((rule, index) => {
    const item = document.createElement('div');
    item.className = `redirect-item${rule.enabled ? '' : ' disabled'}`;
    item.innerHTML = `
      <div class="redirect-info">
        <div class="redirect-status-dot" title="${rule.enabled ? 'Active' : 'Disabled'}"></div>
        <div class="redirect-details">
          <span class="name">${escapeHtml(rule.name)}</span>
          <span class="match-info">
            <span class="match-type-badge">${escapeHtml(rule.matchType)}</span>
            ${escapeHtml(rule.matchPattern)}
          </span>
          <span class="redirect-target">
            <span class="arrow">&rarr;</span>${escapeHtml(rule.redirectUrl)}
          </span>
        </div>
      </div>
      <div class="redirect-actions">
        <label class="toggle-switch" title="${rule.enabled ? 'Disable' : 'Enable'}">
          <input type="checkbox" class="redirect-toggle" data-index="${index}" ${rule.enabled ? 'checked' : ''}>
          <span class="toggle-slider"></span>
        </label>
        <button class="btn-icon redirect-edit-btn" data-index="${index}" title="Edit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button class="btn-icon redirect-delete-btn" data-index="${index}" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    `;
    listEl.appendChild(item);
  });

  // Attach event listeners
  document.querySelectorAll('.redirect-toggle').forEach((toggle) => {
    toggle.addEventListener('change', (e) => {
      toggleRedirectRule(parseInt(e.target.dataset.index), e.target.checked);
    });
  });

  document.querySelectorAll('.redirect-edit-btn').forEach((btn) => {
    btn.addEventListener('click', () => openEditRedirectModal(parseInt(btn.dataset.index)));
  });

  document.querySelectorAll('.redirect-delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteRedirectRule(parseInt(btn.dataset.index)));
  });
}

function setupRedirectEventListeners() {
  document.getElementById('add-redirect').addEventListener('click', openAddRedirectModal);
  document.getElementById('redirect-cancel-btn').addEventListener('click', closeRedirectModal);
  document.querySelector('.redirect-modal-backdrop').addEventListener('click', closeRedirectModal);
  document.getElementById('redirect-form').addEventListener('submit', handleRedirectFormSubmit);

  // Update hint text when match type changes
  document.getElementById('redirect-match-type').addEventListener('change', updateMatchTypeHint);
}

const MATCH_TYPE_HINTS = {
  contains: 'URL must contain this text',
  wildcard: 'Use * for any characters (e.g., https://*.example.com/*)',
  regex: 'Full regular expression (e.g., ^https://.*\\.example\\.com/)',
};

function updateMatchTypeHint() {
  const matchType = document.getElementById('redirect-match-type').value;
  document.getElementById('match-type-hint').textContent = MATCH_TYPE_HINTS[matchType] || '';
}

function openAddRedirectModal() {
  editingRedirectIndex = -1;
  document.getElementById('redirect-modal-title').textContent = 'Add Redirect Rule';
  document.getElementById('redirect-name').value = '';
  document.getElementById('redirect-match-type').value = 'contains';
  document.getElementById('redirect-pattern').value = '';
  document.getElementById('redirect-url').value = '';
  hideRedirectError();
  updateMatchTypeHint();
  document.getElementById('redirect-modal').style.display = 'flex';
  document.getElementById('redirect-name').focus();
}

function openEditRedirectModal(index) {
  editingRedirectIndex = index;
  const rule = redirectRules[index];
  document.getElementById('redirect-modal-title').textContent = 'Edit Redirect Rule';
  document.getElementById('redirect-name').value = rule.name;
  document.getElementById('redirect-match-type').value = rule.matchType;
  document.getElementById('redirect-pattern').value = rule.matchPattern;
  document.getElementById('redirect-url').value = rule.redirectUrl;
  hideRedirectError();
  updateMatchTypeHint();
  document.getElementById('redirect-modal').style.display = 'flex';
  document.getElementById('redirect-name').focus();
}

function closeRedirectModal() {
  document.getElementById('redirect-modal').style.display = 'none';
  editingRedirectIndex = -1;
}

function showRedirectError(message) {
  const errorEl = document.getElementById('redirect-error');
  errorEl.textContent = message;
  errorEl.style.display = 'block';
}

function hideRedirectError() {
  document.getElementById('redirect-error').style.display = 'none';
}

async function handleRedirectFormSubmit(e) {
  e.preventDefault();
  hideRedirectError();

  const name = document.getElementById('redirect-name').value.trim();
  const matchType = document.getElementById('redirect-match-type').value;
  const matchPattern = document.getElementById('redirect-pattern').value.trim();
  const redirectUrl = document.getElementById('redirect-url').value.trim();

  // Validate pattern
  if (!matchPattern) {
    showRedirectError('URL pattern is required.');
    return;
  }

  // Validate redirect URL
  if (!redirectUrl) {
    showRedirectError('Redirect URL is required.');
    return;
  }

  // Validate regex if match type is regex
  if (matchType === 'regex') {
    try {
      new RegExp(matchPattern);
    } catch (err) {
      showRedirectError(`Invalid regex pattern: ${err.message}`);
      return;
    }
  }

  // Check for potential self-redirect loop
  if (matchType === 'contains' && redirectUrl.toLowerCase().includes(matchPattern.toLowerCase())) {
    showRedirectError('Warning: The redirect URL contains the match pattern, which could cause a redirect loop. The extension has loop protection, but consider adjusting your pattern.');
    // Allow saving on second submit (user acknowledges the warning)
    if (!e.target.dataset.loopWarningShown) {
      e.target.dataset.loopWarningShown = 'true';
      return;
    }
  }
  e.target.dataset.loopWarningShown = '';

  const ruleData = {
    name,
    matchType,
    matchPattern,
    redirectUrl,
    enabled: editingRedirectIndex === -1 ? true : redirectRules[editingRedirectIndex].enabled,
  };

  if (editingRedirectIndex === -1) {
    redirectRules.push(ruleData);
  } else {
    redirectRules[editingRedirectIndex] = ruleData;
  }

  await saveRedirectRules();
  renderRedirectRules();
  closeRedirectModal();
}

async function toggleRedirectRule(index, enabled) {
  redirectRules[index].enabled = enabled;
  await saveRedirectRules();
  renderRedirectRules();
}

async function deleteRedirectRule(index) {
  const rule = redirectRules[index];
  if (confirm(`Delete redirect rule "${rule.name}"?`)) {
    redirectRules.splice(index, 1);
    await saveRedirectRules();
    renderRedirectRules();
  }
}

// ============================================================
// Utilities
// ============================================================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
