// ============================================================
// Shortcut to URL - Background Service Worker
// ============================================================
// Handles URL redirect rules. When a user navigates to a URL
// that matches a configured rule, they are automatically
// redirected to the specified destination URL.
// ============================================================

// Track recent redirects per tab to prevent loops
// Map<tabId, { url: string, timestamp: number }>
const recentRedirects = new Map();

// Cooldown period in ms — after a redirect fires on a tab,
// suppress further redirects on that tab for this duration
const REDIRECT_COOLDOWN_MS = 3000;

// ---- Helpers ------------------------------------------------

/**
 * Load enabled redirect rules from storage.
 */
async function getRedirectRules() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ redirectRules: [] }, (result) => {
      resolve(result.redirectRules.filter((rule) => rule.enabled));
    });
  });
}

/**
 * Test whether a URL matches a rule's pattern.
 */
function urlMatchesRule(url, rule) {
  try {
    switch (rule.matchType) {
      case 'contains':
        return url.toLowerCase().includes(rule.matchPattern.toLowerCase());

      case 'wildcard': {
        // Convert wildcard pattern to regex:
        //   * → .*    ? → .    escape everything else
        const escaped = rule.matchPattern
          .replace(/[.+^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.');
        const regex = new RegExp('^' + escaped + '$', 'i');
        return regex.test(url);
      }

      case 'regex': {
        const regex = new RegExp(rule.matchPattern, 'i');
        return regex.test(url);
      }

      default:
        return false;
    }
  } catch (e) {
    console.error('[Redirect] Invalid pattern in rule:', rule.name, e);
    return false;
  }
}

/**
 * Check if a tab was recently redirected (loop prevention).
 */
function wasRecentlyRedirected(tabId) {
  const entry = recentRedirects.get(tabId);
  if (!entry) return false;
  if (Date.now() - entry.timestamp < REDIRECT_COOLDOWN_MS) {
    return true;
  }
  // Expired — clean up
  recentRedirects.delete(tabId);
  return false;
}

/**
 * Record that a redirect happened on a tab.
 */
function recordRedirect(tabId, url) {
  recentRedirects.set(tabId, { url, timestamp: Date.now() });
}

// ---- Core Logic ---------------------------------------------

chrome.webNavigation.onCompleted.addListener(async (details) => {
  // Only act on top-level navigation (not iframes)
  if (details.frameId !== 0) return;

  const tabUrl = details.url;

  // Skip non-http(s) URLs
  if (!tabUrl.startsWith('http://') && !tabUrl.startsWith('https://')) return;

  // Loop prevention: skip if this tab was just redirected
  if (wasRecentlyRedirected(details.tabId)) return;

  const rules = await getRedirectRules();

  // First match wins
  for (const rule of rules) {
    if (urlMatchesRule(tabUrl, rule)) {
      console.log(`[Redirect] Rule "${rule.name}" matched: ${tabUrl} → ${rule.redirectUrl}`);
      recordRedirect(details.tabId, rule.redirectUrl);
      chrome.tabs.update(details.tabId, { url: rule.redirectUrl });
      return; // Stop after first match
    }
  }
});

// ---- Cleanup ------------------------------------------------

// Clean up stale entries from the redirect tracking map every 5 minutes
chrome.alarms.create('redirectCleanup', { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'redirectCleanup') {
    const now = Date.now();
    for (const [tabId, entry] of recentRedirects.entries()) {
      if (now - entry.timestamp > REDIRECT_COOLDOWN_MS) {
        recentRedirects.delete(tabId);
      }
    }
  }
});

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  recentRedirects.delete(tabId);
});

console.log('[Redirect] Service worker loaded. Watching for redirect rules...');
