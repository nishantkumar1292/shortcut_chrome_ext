// ============================================================
// Shortcut status helper (shared by popup + options)
// ============================================================
// The browser does NOT let an extension assign or change its own
// keyboard shortcut. The best we can do is:
//   1. Read the current binding via chrome.commands.getAll()
//   2. Flag problems we can actually detect
//   3. Send the user to the browser's own shortcuts page to fix it
//
// What we can reliably detect:
//   - Unassigned: when the suggested key conflicts at install time, or
//     a command registration goes stale, the browser leaves the
//     command's shortcut empty. This is our only solid proxy for
//     "the hotkey won't work."
// What we CANNOT detect: which other extension/app owns a given key,
// whether an *assigned* key is being intercepted, or a registration
// that displays as set but isn't actually live. We deliberately do
// NOT warn about specific key combos (e.g. Cmd+Period) — they work
// fine in practice, so flagging them only produces false alarms.
// ============================================================

// The browser's keyboard-shortcuts settings page. A plain <a href> to
// a chrome:// URL is blocked, but chrome.tabs.create is allowed.
const SHORTCUTS_SETTINGS_URL = 'chrome://extensions/shortcuts';

/**
 * Read the keyboard shortcut currently bound to the popup command
 * (_execute_action). Returns '' when nothing is assigned.
 */
async function getActionShortcut() {
  try {
    const commands = await chrome.commands.getAll();
    const action = commands.find((c) => c.name === '_execute_action');
    return action && action.shortcut ? action.shortcut : '';
  } catch (e) {
    return '';
  }
}

/**
 * Describe any problem with the current shortcut binding.
 * Returns null when the binding looks fine.
 * @returns {{level: 'error', message: string, action: string}|null}
 */
function getShortcutIssue(shortcut) {
  if (!shortcut) {
    return {
      level: 'error',
      message:
        'No keyboard shortcut is assigned, so the hotkey won’t open this popup. ' +
        'This usually means the suggested key was already in use by the browser or ' +
        'another extension. Assign one in the browser’s shortcut settings.',
      action: 'Set shortcut',
    };
  }

  return null;
}

/**
 * Open the browser's keyboard-shortcuts settings page in a new tab.
 */
function openShortcutsPage() {
  chrome.tabs.create({ url: SHORTCUTS_SETTINGS_URL });
}
