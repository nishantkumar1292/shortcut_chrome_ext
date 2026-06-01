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

### 2. Enable the API + create an OAuth client
1. In [Google Cloud Console](https://console.cloud.google.com/), create (or pick)
   a project.
2. **APIs & Services → Library** → enable **Chrome Web Store API**.
3. **APIs & Services → OAuth consent screen** → configure it (External is fine;
   add your own Google account as a test user).
4. **APIs & Services → Credentials → Create credentials → OAuth client ID** →
   application type **Desktop app**. Copy the **client ID** and **client secret**.

### 3. Get a refresh token
Authorize the client once for the scope `https://www.googleapis.com/auth/chromewebstore`:

1. Visit this URL in a browser (replace `YOUR_CLIENT_ID`):
   ```
   https://accounts.google.com/o/oauth2/auth?response_type=code&scope=https://www.googleapis.com/auth/chromewebstore&access_type=offline&prompt=consent&redirect_uri=urn:ietf:wg:oauth:2.0:oob&client_id=YOUR_CLIENT_ID
   ```
   Approve, and copy the authorization `code`.
2. Exchange it for a refresh token:
   ```bash
   curl -s "https://oauth2.googleapis.com/token" \
     -d "client_id=YOUR_CLIENT_ID" \
     -d "client_secret=YOUR_CLIENT_SECRET" \
     -d "code=THE_CODE" \
     -d "grant_type=authorization_code" \
     -d "redirect_uri=urn:ietf:wg:oauth:2.0:oob"
   ```
   The JSON response contains `refresh_token`.

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
