# Publishing to the Chrome Web Store

The release is automated via the Chrome Web Store API. You provide credentials
once; after that, publishing a new version is two commands.

## One-time setup: get credentials

You need four values, stored as environment variables (never committed):

| Env var             | What it is                                  |
| ------------------- | ------------------------------------------- |
| `CWS_EXTENSION_ID`  | The published extension's app ID            |
| `CWS_CLIENT_ID`     | OAuth 2.0 client ID                         |
| `CWS_CLIENT_SECRET` | OAuth 2.0 client secret                     |
| `CWS_REFRESH_TOKEN` | Refresh token for that OAuth client         |

### 1. Extension ID
From the [Developer Dashboard](https://chrome.google.com/webstore/devconsole),
open the item — the ID is the long string in its URL / details page.

### 2. Enable the API + configure the consent screen
1. In [Google Cloud Console](https://console.cloud.google.com/), create (or pick)
   a project.
2. **APIs & Services → Library** → search "Chrome Web Store API" → **Enable**.
   (Separate from OAuth — the publish call 403s without it.)
3. **Google Auth Platform / OAuth consent screen** → configure branding + audience
   (External is fine). Under **Audience → Test users**, add your own Google account.

### 3. Create an OAuth client
Google deprecated the old "Desktop app + out-of-band (oob)" flow, so use a
**Web application** client together with the OAuth Playground:

1. **Create OAuth client** → application type **Web application**.
2. Name it anything (e.g. `Chrome Web Store publish`).
3. Under **Authorized redirect URIs**, add:
   `https://developers.google.com/oauthplayground`
4. Create, then copy the **client ID** and **client secret**.

### 4. Get a refresh token (via OAuth Playground)
1. Open <https://developers.google.com/oauthplayground>.
2. Click the ⚙️ (top right) → check **Use your own OAuth credentials** → paste the
   client ID and secret.
3. In **Input your own scopes**, enter
   `https://www.googleapis.com/auth/chromewebstore` → **Authorize APIs** → sign in
   and approve (click through any "unverified app" warning).
4. Click **Exchange authorization code for tokens** → copy the **refresh token**.

> While the consent screen is in **Testing** mode, refresh tokens expire after
> **7 days**. If publishing later fails with an auth error, re-run this step — or
> set the consent screen to **In production** for a long-lived token.

## Store the credentials (kept out of git)

Create a `.env` file in the repo root (it is gitignored):

```
CWS_EXTENSION_ID=your_extension_id
CWS_CLIENT_ID=your_client_id
CWS_CLIENT_SECRET=your_client_secret
CWS_REFRESH_TOKEN=your_refresh_token
```

## Release a new version

1. Bump `"version"` in `manifest.json` (the Web Store rejects re-using a version).
2. Build and publish:
   ```bash
   node scripts/build-zip.mjs
   node --env-file=.env scripts/publish.mjs
   ```

`publish.mjs` uploads the package and submits it. Google may hold the update for
review before it goes live — track status in the Developer Dashboard.
