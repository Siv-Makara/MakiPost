# MakiPost - ខ្មែរ 🇰🇭

**MakiPost** (formerly *Sar*) is a fast desktop API client, made in Cambodia, in the spirit of Postman and Bruno.
Collections are plain JSON files you can commit to Git, environments make switching between
servers easy, and the whole look of the app can be themed, including your own background image.

Built with Electron, Vue 3, Vite, Pinia, Tailwind CSS and CodeMirror 6.

**Current version: 0.7.2**

**⬇ [Download MakiPost for Windows (.exe)](https://github.com/Siv-Makara/MakiPost/releases/latest/download/MakiPost-Setup.exe)** · [portable version](https://github.com/Siv-Makara/MakiPost/releases/latest/download/MakiPost-Portable.exe) · [all releases](https://github.com/Siv-Makara/MakiPost/releases)

---

## Contents

- [Features](#features)
- [Install](#install)
- [Quick start](#quick-start)
- [User guide](#user-guide)
  - [Sending requests](#sending-requests)
  - [Authorization](#authorization)
  - [Request settings: timeout, redirects, SSL](#request-settings-timeout-redirects-ssl)
  - [Search and navigation](#search-and-navigation)
  - [Importing from Postman](#importing-from-postman)
  - [cURL import and export](#curl-import-and-export)
  - [History](#history)
  - [Collections](#collections)
  - [Environments and variables](#environments-and-variables)
  - [Capturing values from responses](#capturing-values-from-responses)
  - [Appearance](#appearance)
  - [Keyboard shortcuts](#keyboard-shortcuts)
  - [Where MakiPost stores data](#where-sar-stores-data)
- [Development](#development)
- [Architecture](#architecture)
- [Changelog](#changelog)
- [Roadmap](#roadmap)
- [Troubleshooting](#troubleshooting)

---

## Features

- **Postman import**: bring in Postman collections (v2.0 / v2.1) with folders, bodies, auth and
  variables.
- **Auth**: Bearer, Basic, API Key, Digest and OAuth 2.0 (Authorization Code with PKCE, Client
  Credentials, Password) with automatic token fetch and refresh.
- **Request settings**: per-request timeout, follow redirects on/off, and SSL verification on/off for
  self-signed development servers.
- **Search everywhere**: `Ctrl+P` jumps to any request, tab, environment or command. Filter the
  collection tree, and find text in responses.
- **cURL**: paste a `curl` command (including Chrome DevTools' *Copy as cURL*, bash or cmd) to
  import the whole request, and copy any request as cURL.
- **History**: the last 100 requests you sent, searchable, one click to reopen.
- **Capture**: save values from a response (e.g. a login token) into variables automatically.
- **Requests**: GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS. Query params kept in sync with the URL, headers with
  suggestions, body as JSON, form-data (including files), x-www-form-urlencoded or raw (text, XML,
  HTML, JavaScript).
- **Responses**: color-coded status, time, size, headers, and a pretty-printed, syntax-highlighted
  body. Image preview, copy, and save to file.
- **Speed**: reused connections, DNS cache and prefetching, warm-up at launch, plus a per-request
  timing breakdown. See [Performance](#performance).
- **Tabs**: open many requests at once. Unsaved changes are marked, and open tabs (even unsaved
  ones) come back after a restart. Right-click a tab to close others, duplicate it, and more.
- **Collections**: a folder on your computer with one JSON file per request, and real sub-folders.
  You can create, rename, duplicate, delete, and drag to reorder or move items.
- **Environments**: Globals plus any number of environments, a switcher in the top bar, `{{variables}}`
  everywhere with highlighting and autocomplete, nested and built-in dynamic variables, secret
  values, and Postman-compatible import/export.
- **Appearance**: theme presets (including Khmer-inspired *Angkor*, *Tonle Sap*, *Romduol* and
  *Night Market*), custom colors, panel opacity, and a background image with fit, overlay and blur.
- **Khmer support**: Khmer text is rendered with Kantumruy Pro, which is bundled so it works offline.

## Install

### Windows

Download `MakiPost-Setup.exe` from the
[latest release](https://github.com/Siv-Makara/MakiPost/releases/latest), or build it yourself
(see [Packaging](#packaging)). Then run:

- `MakiPost-Setup.exe`: installer. You can choose the install folder, and it adds desktop and
  Start Menu shortcuts. Uninstall from *Settings → Apps*. If you installed the old *Sar* app, you can
  uninstall it there too; MakiPost copies its settings on first launch.
- `MakiPost-Portable.exe`: portable. Runs without installing.

The installed version **updates itself**: it checks GitHub for a new release when it starts (and
every 6 hours), downloads it in the background, then asks *Restart now* or *Later* (Later installs
it when you close MakiPost). The portable version doesn't auto-update; download the new one.

> The app isn't code-signed, so Windows SmartScreen may say *"Windows protected your PC"*.
> Click **More info → Run anyway**.

### macOS / Linux

Run `npm run dist:mac` on a Mac (`.dmg`, `.zip`) or `npm run dist:linux` on Linux (`AppImage`,
`.deb`). Each platform has to be built on that platform.

## Quick start

1. **Send a request**: type `https://jsonplaceholder.typicode.com/users` in the URL bar and press
   **Ctrl+Enter** (⌘+Enter on macOS).
2. **Create a collection**: click the 📂 button in the sidebar header and choose or create a folder.
3. **Save the request**: press **Ctrl+S**, pick the collection, and give the request a name.
4. **Add an environment**: click the sliders button next to *No Environment* in the top bar, then
   **+ New environment**, and add `baseUrl` = `https://jsonplaceholder.typicode.com`. Select it in the
   top bar and change the URL to `{{baseUrl}}/users`.
5. **Make it yours**: click ⚙ (or press **Ctrl+,**), then pick a theme preset or upload a
   background image.

---

## User guide

### Sending requests

| Part | How it works |
|---|---|
| **Method** | Click the method (GET, POST…) to change it. |
| **URL** | `http://` is added if you leave out the scheme. Pasting a `curl …` command imports the whole request (see below). |
| **Params** | Query parameters and the URL stay in sync both ways. Untick a row to keep it without sending it. |
| **Headers** | Header names autocomplete common headers. Untick a row to disable it. |
| **Body** | *JSON* (with **Beautify**), *Form Data* (text or file fields), *x-www-form-urlencoded*, *Raw* (text, XML, HTML or JavaScript). `Content-Type` is set for you unless you set it yourself. |
| **Auth** | Bearer, Basic, API Key, Digest or OAuth 2.0. See [Authorization](#authorization). |
| **Capture** | Save values from the response into variables. See [Capturing values](#capturing-values-from-responses). |
| **Settings** | Timeout, redirects and SSL verification for this request. See [Request settings](#request-settings-timeout-redirects-ssl). |

Press **Send** or **Ctrl+Enter**. While a request is running, **Send** turns into **Cancel**.

**Response panel**

- **Status** is colored by type: 2xx green, 3xx blue, 4xx orange, 5xx red.
- **Time**: hover it to see the timing breakdown (DNS, TCP + TLS, waiting for the server, download)
  and whether the connection was reused.
- **Size** is the size of the response body.
- **Body** can be shown *Pretty* or *Raw*, and has **Find**, **Copy** and **Save…** buttons. Images
  are shown as a preview. **Find** (or `Ctrl+F` inside the body) supports match case, regular
  expressions and whole words.
- **Headers** lists every response header, including each `set-cookie` separately.
- Very large responses: above 5 MB the body is shown raw. Above 10 MB only the first 10 MB is shown,
  with **Show all** and **Save to file** buttons.

### Authorization

Open the request's **Auth** tab and pick a type. Every field accepts `{{variables}}`.

| Type | What MakiPost sends |
|---|---|
| **Bearer Token** | `Authorization: Bearer <token>` |
| **Basic Auth** | `Authorization: Basic <base64 of username:password>` (UTF-8, so Khmer usernames work) |
| **API Key** | Your key name and value, either as a **header** (e.g. `X-Api-Key: …`) or as a **query param** (e.g. `?api_key=…`) |
| **Digest Auth** | Sends the request, reads the server's Digest challenge from the `401` response, and sends it again with the answer. Supports MD5, SHA-256 and their `-sess` variants with `qop=auth`. |
| **OAuth 2.0** | Gets an access token, then sends `Authorization: Bearer <token>`. See below. |

For Bearer, Basic, Digest and OAuth 2.0, a header you set yourself in **Headers** wins over the Auth tab.

**OAuth 2.0**

1. Choose the **Grant type**:
   - **Authorization Code**: you sign in on the provider's page. Fill in *Auth URL*, *Access Token
     URL*, *Client ID* and *Callback URL*. **PKCE** is on by default; *Client Secret* is optional with
     PKCE.
   - **Client Credentials**: machine-to-machine. Fill in *Access Token URL*, *Client ID* and *Client Secret*.
   - **Password**: also asks for the user's *Username* and *Password*.
2. Just press **Send**. MakiPost gets a token the first time (for Authorization Code a small sign-in
   window opens), then reuses it. When it expires, MakiPost uses the refresh token if the server gave one,
   or gets a new token, without you doing anything.
3. **Get New Access Token** forces a fresh token. **Copy** and **Clear** are next to the token.

Good to know:

- **Callback URL**: register it with your provider (default `http://localhost:8765/callback`). MakiPost
  catches the redirect inside the sign-in window, so nothing has to run at that address.
- **Tokens are not saved in the request file**, so they never end up in Git. MakiPost keeps them in
  `sar-oauth.json`, encrypted with your system's secure storage (Windows DPAPI, macOS Keychain, Linux
  Secret Service) where available.
- Requests with the same OAuth settings (token URL, client ID, scope…) share one token.
- **Advanced**: send the client ID/secret as a *Basic Auth header* instead of in the body, and change
  the header prefix (e.g. `token` for GitHub-style APIs, or empty for none).
- The sign-in window keeps its own cookies, so "remember me" on the provider's page works next time.

### Request settings: timeout, redirects, SSL

Each request has a **Settings** tab. A dot on the tab means something differs from the defaults.

| Setting | Default | What it does |
|---|---|---|
| **Timeout** | None | Give up if the whole response hasn't arrived in this many seconds. Quick picks: None, 5s, 30s, 60s. |
| **Follow redirects** | On | When off, you see the `3xx` response itself, with its `Location` header. |
| **Verify SSL certificates** | On | Turn off only for development servers with a self-signed certificate. When off, MakiPost uses a separate connection pool, so unchecked connections are never reused by other requests. |

Settings are saved in the request file only when they differ from the defaults. They are also
included in cURL import and export (`--max-time`, `-L`, `-k`).

### Search and navigation

- **Command palette**: press **Ctrl+P** (or **Ctrl+K**), or click the search box in the top bar. Type
  a few letters to jump to any request in any collection, an open tab, or a command (new tab, import,
  switch environment, settings…). Use **↑ / ↓** and **Enter**. Words can match in any order, and also
  match folder names and methods, e.g. `post users`.
- **Filter the sidebar**: type in **Filter requests** above the collection tree. Matching requests are
  shown with their folders opened. A matching folder shows everything in it. **Esc** clears it.
- **Tab menu**: right-click a tab for **Close Others**, **Close to the Right**, **Close Saved**,
  **Duplicate**, **Rename**, **Show in Sidebar**, and **Copy as cURL**. Tabs with unsaved changes
  still ask before closing.
- **Keyboard shortcuts**: press **Ctrl+/** for the full list.

### Importing from Postman

1. In Postman, export the collection: *… → Export → Collection v2.1*.
2. In MakiPost, click **Import** (the ⤓ icon in the sidebar header) → **Postman collection…**, or use the
   command palette. You can pick several files at once.
3. Choose the folder to create the collection in. MakiPost creates a sub-folder named after the
   collection, with one file per request.

What is imported:

| Postman | MakiPost |
|---|---|
| Folders and sub-folders | real folders, in the same order |
| Method, URL, query params (including disabled ones), headers | same |
| Path variables like `/users/:id` | replaced with their value (e.g. `/users/7`) |
| Body: raw (JSON, XML, HTML, JS, text), form-data (text and file), urlencoded | same |
| Body: GraphQL | JSON body `{ "query": …, "variables": … }` |
| Auth: Bearer, Basic, API Key, Digest, OAuth 2.0, No Auth | same |
| Auth set on the collection or a folder ("inherit") | written into each request that inherits it |
| Collection variables | a new environment named after the collection (made active if none is) |
| `{{variables}}` and `{{$guid}}` / `{{$timestamp}}` / `{{$randomInt}}` | work as-is |

Not imported (a message tells you how many): pre-request and test scripts, other auth types (AWS,
Hawk, NTLM…), binary-file bodies, and OAuth tokens (MakiPost gets its own). Postman **environments** are
imported in **Manage Environments → Import**.

### cURL import and export

**Import**, either way:

- **Paste a `curl` command into the URL bar.** It fills in the current tab: method, URL, params,
  headers, body and auth.
- Or click **cURL → Import cURL…** next to Save, paste, and press **Import** (or Ctrl+Enter). The
  request opens in a new tab.

Works with Chrome/Edge DevTools (*Network → right-click a request → Copy → Copy as cURL*, both
**bash** and **cmd** versions), Firefox, and the examples in most API docs. Understood:

| cURL | Becomes |
|---|---|
| `-X`, `--request` | method (`-I` / `--head` = HEAD; a body without `-X` = POST) |
| `-H`, `--header` | headers. `Authorization: Bearer …` and `Basic …` go to the Auth tab |
| `-d`, `--data`, `--data-raw`, `--data-binary`, `--json` | body: JSON, x-www-form-urlencoded or raw, detected from `Content-Type` and the data |
| `--data-urlencode`, `-G` / `--get` | encoded form data, or query parameters with `-G` |
| `-F`, `--form` | form-data, including files (`-F 'file=@/path/pic.png'`) |
| `-u`, `--user` | Basic auth |
| `-b`, `-A`, `-e` | `Cookie`, `User-Agent`, `Referer` headers |
| `-s`, `-L`, `-k`, `--compressed`, `-o …`, `--max-time …` | ignored, since they don't change the request |

`{{variables}}` inside a cURL command are kept as variables.

**Export**: click **cURL** next to Save and choose **Copy as cURL (bash)** (macOS, Linux, Git
Bash, WSL) or **Copy as cURL (Windows cmd)**. Variables are replaced with values from the active
environment, so the command runs as-is. You can also right-click a request in the sidebar or in
History to copy it as cURL.

### History

Switch the sidebar to **History** to see the last 100 requests you sent, grouped by day, with
method, URL, status, duration and time.

- **Click** an entry to open it in a tab (with its headers, body, auth and captures as they were when
  sent).
- **Search** by URL, name, method or status.
- **Right-click** for Open, Copy URL, Copy as cURL, or Delete. **Clear** removes everything.
- Bodies larger than 100 KB aren't kept in history, to keep it small.
- **History is cleared automatically when you close MakiPost**, so each session starts clean. To keep
  history between sessions, untick **Settings → General → Clear history when MakiPost closes** (or click
  **change** at the bottom of the History panel). **Clear history now** is there too.

### Collections

A collection is a normal folder on your computer. Each request is saved as its own `.json` file, and
folders in the sidebar are real folders on disk, so you can commit a collection to Git and review
changes like code.

**Sidebar header buttons**

| Button | Action |
|---|---|
| 📄+ | New request, created in the selected folder |
| 📁+ | New folder, created in the selected folder |
| 📂 | Open or create a collection folder |
| ⟳ | Refresh (picks up changes made outside MakiPost, e.g. `git pull`) |

Click a folder to select it; the header buttons then create inside it. Hover a folder to get quick
**new request** and **new folder** buttons on that row.

**Right-click** any item (or use its **⋯** button) for: New Request, New Folder, Open, Duplicate,
Rename, Show in Explorer/Finder, Delete (moves to the system trash), and Close Collection (removes
it from the sidebar without deleting files).

**Drag and drop** items to reorder them, or drop them on a folder to move them into it.

**Saving**: **Ctrl+S** or the **Save** button. A dot on a tab means unsaved changes. A new request
asks where to save it. Closing a tab with unsaved changes asks first.

**Files on disk**

```
my-api/
  sar-collection.json      { "sar": 1, "name": "My API" }
  .sar-order.json          sidebar order of this folder (written when you add or drag items)
  Health check.json
  Users/
    .sar-order.json
    List users.json
```

A request file:

```json
{
  "sar": 1,
  "name": "List users",
  "method": "GET",
  "url": "{{baseUrl}}/users?page=1",
  "params": [{ "key": "page", "value": "1", "enabled": true }],
  "headers": [{ "key": "Accept", "value": "application/json", "enabled": true }],
  "body": { "mode": "none", "json": "", "raw": "", "rawType": "text/plain", "formData": [], "urlencoded": [] },
  "auth": { "type": "bearer", "bearer": { "token": "{{token}}" }, "basic": { "username": "", "password": "" } },
  "captures": [{ "key": "firstUserId", "value": "body[0].id", "enabled": true }]
}
```

The request's display name can contain any characters. The file name is a cleaned-up version of it
(characters Windows doesn't allow are removed). JSON files that aren't MakiPost requests, such as
`package.json`, are ignored.

### Environments and variables

**Switch** environments with the dropdown in the top bar (a green dot means one is active).
**Manage** them with the sliders button next to it.

- **Globals** are available in every request. The active environment overrides a global with the
  same name.
- Write `{{name}}` in the URL, params, headers, body (JSON, raw, form fields) or auth fields.
  - Defined variables are highlighted **green**, undefined ones **red**.
  - Type `{{` to get autocomplete (arrow keys, then Enter or Tab).
  - When the URL contains variables, the real URL is previewed under the URL bar.
  - In the body editor, hover a variable to see its value and where it comes from.
- **Nested variables**: a value can use other variables, e.g. `baseUrl` = `https://{{host}}/v1`.
- **Built-in dynamic variables** (a new value on every send):

  | Variable | Value |
  |---|---|
  | `{{$guid}}` | random UUID v4 |
  | `{{$timestamp}}` | Unix time in seconds |
  | `{{$isoTimestamp}}` | current time, ISO 8601 |
  | `{{$randomInt}}` | random integer 0–1000 |

- **Secrets**: click the 🔒 icon on a variable to mask its value, and 👁 to reveal it.
- **Import / export** uses the Postman environment format, so Postman environment files import
  directly. You can select several files at once.
- If you send a request that uses an undefined variable, a warning lists the missing names.

> **Note:** secret values are only masked on screen. They are stored **unencrypted** in MakiPost's
> settings file and are included in exports.

### Capturing values from responses

Use the request's **Capture** tab to save values from its response into variables, so you don't have
to copy and paste them. Typical use: capture the token from `POST /login` once, then every other
request uses `{{token}}`.

| Variable name | From response |
|---|---|
| `token` | `body.access_token` |
| `userId` | `$.user.id` |
| `requestId` | `header.x-request-id` |

After each response, each rule is evaluated and the value is saved to the **active environment** (or
to **Globals** if none is active). Variables are created if they don't exist, and names containing
*token*, *secret*, *password* or *api key* are marked secret automatically. A message confirms what
was saved, or lists rules that found nothing.

| Expression | Captures |
|---|---|
| `body.token` | a field of a JSON body |
| `body.data.items[0].id` | nested fields and array items; `[-1]` is the last item |
| `body["odd-key"]` | keys with special characters |
| `$.access_token` | JSONPath style, same as `body.access_token` |
| `header.x-request-id` | a response header (case-insensitive) |
| `cookie.session` | a cookie from `Set-Cookie` |
| `status` / `body` | the status code / the whole body text |

The Capture tab also shows a **preview** of what each rule captures from the response currently
shown, so you can check your paths without sending again. Capture rules are saved in the request
file (`"captures"`), so they're shared through Git with the collection.

### Appearance

Open **Settings → Appearance** with ⚙ in the top bar or **Ctrl+,**. Changes apply instantly and are
saved automatically.

- **Theme presets**: MakiPost Dark, Angkor (sandstone and gold), Tonle Sap (deep blue and teal), Romduol
  (soft pink and cream), Night Market (dark with neon).
- **Colors**: Background (behind the panels), Panels, Text, Accent (buttons, active tabs). Borders,
  muted text and code colors are worked out from these, and adjust automatically for light themes.
- **Panel opacity**: lower it to let the background show through the panels.
- **Background image**: PNG, JPG or WebP. MakiPost keeps its own copy, so moving or deleting the original
  is fine. Options: **Fit** (cover, contain, tile), **Overlay** (0–100 %), **Blur** (0–20 px), and
  **Remove background**.
- **Reset to default** restores the original look and removes the background image.

### Keyboard shortcuts

| Action | Windows / Linux | macOS |
|---|---|---|
| Send request | `Ctrl+Enter` | `⌘+Enter` |
| Save request | `Ctrl+S` | `⌘+S` |
| New tab | `Ctrl+T` | `⌘+T` |
| Close tab | `Ctrl+W` or middle-click | `⌘+W` or middle-click |
| Next / previous tab | `Ctrl+Tab` / `Ctrl+Shift+Tab` | same |
| Command palette | `Ctrl+P` or `Ctrl+K` | `⌘+P` or `⌘+K` |
| Keyboard shortcuts | `Ctrl+/` | `⌘+/` |
| Find in response | `Ctrl+F` (click the body first) | `⌘+F` |
| Tab menu | right-click a tab | same |
| Focus URL bar | `Ctrl+L` | `⌘+L` |
| Settings | `Ctrl+,` | `⌘+,` |
| Rename tab | double-click the tab | same |
| Accept variable suggestion | `Enter` or `Tab` | same |
| Import in the cURL dialog | `Ctrl+Enter` | `⌘+Enter` |
| Developer tools | `Ctrl+Shift+I` | `⌥⌘I` |

### Where MakiPost stores data

| Data | Location |
|---|---|
| Collections and requests | the folders you opened as collections |
| Settings, environments, open tabs | `sar-settings.json` in the app data folder |
| Request history | `sar-history.json` in the app data folder |
| OAuth 2.0 tokens (encrypted) | `sar-oauth.json` in the app data folder |
| Background image | `backgrounds/` in the app data folder |

The app data folder is `%APPDATA%\MakiPost` on Windows, `~/Library/Application Support/MakiPost` on macOS, and
`~/.config/MakiPost` on Linux.

---

## Development

### Requirements

- Node.js 18 or newer (20 LTS recommended)
- npm 9 or newer

### Setup and scripts

```bash
npm install

npm run dev       # Vite + Electron with hot reload for the renderer
npm run build     # compile main, preload and renderer into out/
npm run preview   # run the compiled app from out/
```

### Packaging

Packaging uses electron-builder; settings are in `electron-builder.yml`.

```bash
npm run dist:win     # NSIS installer + portable .exe  → dist/
npm run dist:mac     # .dmg + .zip                     → dist/
npm run dist:linux   # AppImage + .deb                 → dist/
npm run dist         # current platform
```

- Build each platform on that platform.
- Code signing and notarization use the usual electron-builder environment variables
  (`CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, …). Without them, builds are unsigned.
- For a custom app icon, put `icon.ico`, `icon.icns` and a 512×512 `icon.png` in `build/`.
- If a build fails because a file in `dist\` is in use, close that copy of MakiPost or bump
  `version` in `package.json`.

### Publishing a release (GitHub)

Releases are hosted on GitHub: <https://github.com/Siv-Makara/MakiPost/releases>. Installed copies
of MakiPost update from there.

**One-time setup**

1. Create a token: GitHub → *Settings → Developer settings → Personal access tokens → Tokens
   (classic) → Generate new token*, with the **`repo`** scope (or **`public_repo`** for a public
   repository). Copy it.
2. Save it for your Windows user, in PowerShell (then open a new terminal):
   ```powershell
   setx GH_TOKEN "ghp_your_token_here"
   ```
   Never commit the token or paste it into a file in the project.

**Each release**

1. Bump `version` in `package.json` (e.g. `npm pkg set version=0.7.3`) and add a Changelog entry.
2. Commit and push:
   ```bash
   git commit -am "Release 0.7.3"
   git tag v0.7.3
   git push --follow-tags
   ```
3. Build and upload in one step:
   ```bash
   npm run release
   ```
   This creates a **draft** release `v0.7.3` on GitHub with the installer, the portable `.exe`,
   `latest.yml` and the `.blockmap`. Auto-update needs `latest.yml` and the `.blockmap`, so keep them.
4. On GitHub, open the draft, paste the changelog, and click **Publish release**. Installed copies
   pick it up on their next check.

To upload by hand instead (no token): run `npm run dist:win` and drag `MakiPost-Setup.exe`,
`MakiPost-Setup.exe.blockmap`, `latest.yml` and `MakiPost-Portable.exe` from `dist\`
into a new release with the tag `vx.y.z`.

### Project structure

```
src/
  main/                       Electron main process (Node)
    index.js                  window, menu, IPC, dialogs
    http.js                   request engine: undici pool, DNS cache, timings, cancel,
                              timeout, redirects, SSL option, Digest auth
    oauth.js                  OAuth 2.0: grants, sign-in window, PKCE, encrypted token cache
    updater.js                auto-update from GitHub Releases
    migrate.js                copies data from the old "Sar" folder on first launch
    collections.js            collection folders: read tree, create, rename, move, delete
    appearance.js             background images + sar-bg:// protocol
    store.js                  electron-store settings
  preload/
    index.js                  contextBridge: the narrow window.sar API
  renderer/                   Vue app (no Node access)
    index.html                CSP
    src/
      App.vue                 layout + global shortcuts
      main.js                 bootstrap (loads theme, environments, session before first paint)
      components/
        RequestEditor.vue     URL bar, params / headers / body / auth / capture / settings tabs
        AuthEditor.vue        Bearer, Basic, API Key, Digest, OAuth 2.0 (+ token status)
        RequestOptions.vue    per-request timeout, redirects, SSL verification
        CommandPalette.vue    Ctrl+P search across requests, tabs and commands
        ShortcutsModal.vue    Ctrl+/ keyboard shortcuts
        CaptureEditor.vue     capture rules + live preview
        CurlImportModal.vue   Import cURL dialog
        ResponseViewer.vue    status, timing breakdown, body, headers
        CodeEditor.vue        CodeMirror 6 wrapper (themes via CSS variables, {{var}} support)
        VarInput.vue          single-line input with {{var}} highlighting + autocomplete
        KeyValueTable.vue     rows for params, headers, form fields, variables
        EnvironmentsModal.vue environment manager
        sidebar/              collection tree with drag and drop, history panel
        settings/             Settings → Appearance
      stores/                 Pinia: tabs, collections, environments, history, appearance, ui
      lib/                    request model and file format, URL ⇄ params, request builder,
                              variables, cURL parse/export, Postman import, capture expressions,
                              search, colors, formatting
      styles/main.css         Tailwind + theme tokens
electron.vite.config.mjs
electron-builder.yml
tailwind.config.js
```

---

## Architecture

### Security model

- The renderer runs with `contextIsolation: true`, `nodeIntegration: false` and `sandbox: true`.
  It can only use what the preload script exposes on `window.sar`.
- **All HTTP requests are sent by the main process**, never by the renderer, so there are no CORS
  restrictions. The renderer builds a plain request object and sends it over IPC.
- The main process only reads and writes files inside folders you have opened as collections,
  checked on every call.
- A strict Content-Security-Policy is set; new windows are blocked and external links open in the
  system browser.

### Performance

Requests go through one tuned [undici](https://github.com/nodejs/undici) connection pool
(`src/main/http.js`):

- **Long keep-alive**: 30 s by default, up to 10 min if the server allows it, so repeat requests
  skip TCP + TLS setup. Node's built-in `fetch` drops idle connections after 4 s.
- **DNS cache** (5 min), plus **prefetching**: the host is looked up while you're still typing the
  URL.
- **Warm-up** at launch: one request through the whole client path, and TLS root certificates
  loaded, so the first real request isn't slowed by start-up work.
- **Safe retry**: if the server closed a kept-alive connection just as it was reused, the request is
  retried once on a new connection, as browsers do.
- **Timing breakdown** from undici's diagnostics channels: prepare, DNS, TCP + TLS, waiting (TTFB),
  download, and whether the connection was reused.

In the renderer:

- The response view stays mounted between sends, so the editor isn't rebuilt every time.
- Responses are kept out of Vue's deep reactivity (`markRaw`).
- Large bodies skip pretty-printing (above 5 MB) and line wrapping (above 1 MB), and render at most
  10 MB unless you ask for more.

Measured on the same machine (example.com over HTTPS, and a local API):

| | 0.3.0 | 0.4.0 |
|---|---|---|
| First request after launch | 500–690 ms | 230–260 ms |
| Request after 6 s idle | 127–154 ms | 55–63 ms |
| Click → response shown (local API) | ~48 ms | 12–24 ms |
| 8 MB JSON, click → rendered | 756 ms | 387 ms |

### Theming

Every color is a CSS variable holding `r g b` channels (e.g. `--sar-accent: 99 132 255`). Tailwind
maps them to utilities (`bg-panel`, `text-accent`, `text-m-get`, …), so applying a theme just means
setting variables, and it takes effect instantly. The Appearance store derives secondary colors
(surface, border, muted text, code and method colors) from the four colors you choose.

---

## Changelog

### 0.7.2: Hosting and auto-update
- Releases are published on GitHub, with a download link at the top of this README.
- The installed version updates itself from GitHub Releases (background download, *Restart now* or
  *Later*).
- `npm run release` builds and uploads a draft release. The portable file is now named
  `MakiPost-Portable.exe`.
- File names no longer include the version, so
  <https://github.com/Siv-Makara/MakiPost/releases/latest/download/MakiPost-Setup.exe> always
  downloads the newest installer in one click.

### 0.7.1
- The name is shown as **MakiPost - ខ្មែរ** with the Cambodian flag 🇰🇭 in the top bar, the About page
  and the empty response area. The flag is drawn by the app, because Windows can't show flag emoji.

### 0.7.0: New name, MakiPost
- The app is now called **MakiPost** (it was *Sar*). New installer name, window title and logo.
- On first launch, MakiPost copies your settings, environments, open tabs, history, OAuth tokens and
  background image from the old *Sar* data folder. Collections work as before; their file format is
  unchanged.
- New **Settings → About** page with the version and copyright.

### 0.6.1
- History is cleared automatically when MakiPost closes. New **Settings → General** page with a switch to
  keep history between sessions instead, and a **Clear history now** button.

### 0.6.0: Postman import, more auth, request settings, search
- **Postman import**: collections v2.0/v2.1 with folders, bodies (incl. GraphQL), auth (with
  folder/collection inheritance), disabled params and headers, path variables, and collection
  variables as an environment.
- **Auth**: new **API Key** (header or query), **Digest** (MD5 / SHA-256, `qop=auth`) and **OAuth 2.0**
  (Authorization Code + PKCE in a sign-in window, Client Credentials, Password) with automatic token
  reuse and refresh. Tokens are stored encrypted, outside request files.
- **Request settings** tab: timeout, follow redirects, verify SSL certificates. Clear messages for
  timeouts and certificate errors.
- **Command palette** (`Ctrl+P` / `Ctrl+K`) and a search box in the top bar.
- **Sidebar filter**, **tab right-click menu** (close others / to the right / saved, duplicate, show
  in sidebar), **Find** in responses, and a **keyboard shortcuts** sheet (`Ctrl+/`).
- cURL: import `-k`, `--digest`, `-m`; export adds `-L`, `-k`, `--max-time` and `--digest` to match
  the request's settings.

### 0.5.0: History, cURL, Capture
- **History**: the last 100 sent requests in the sidebar, with search, click to reopen, Copy as cURL
  and delete/clear. Stored in `sar-history.json`.
- **cURL import**: paste into the URL bar, or use *Import cURL…*. Supports Chrome/Firefox
  "Copy as cURL" (bash and cmd) and the common flags: headers, data, JSON, form uploads, `-u`, `-G`,
  cookies, and Bearer/Basic going to the Auth tab.
- **cURL export**: *Copy as cURL* for bash or Windows cmd, from the URL bar, the sidebar or History.
- **Capture**: a new request tab that saves response values (`body.token`, `$.user.id`,
  `header.x`, `cookie.x`, `status`) into the active environment after each response, with a
  live preview.
- HEAD and OPTIONS methods.

### 0.4.0: Performance
- New request engine (undici) with long keep-alive, DNS cache, DNS prefetch while typing, warm-up at
  launch, and safe retry on stale connections.
- Timing breakdown when you hover **Time**.
- Faster response rendering; handling of very large responses (show all, save to file).
- **Save…** button for response bodies.

### 0.3.0: Environments
- Globals and environments, top-bar switcher, environment manager.
- `{{variable}}` substitution with green/red highlighting, autocomplete, URL preview and hover info.
- Nested and dynamic variables (`$guid`, `$timestamp`, `$isoTimestamp`, `$randomInt`).
- Secret variables; Postman-compatible import/export; undefined-variable warnings.

### 0.2.1
- Visible **New Request** / **New Folder** buttons in the sidebar header and on folder rows.

### 0.2.0: Collections and appearance
- Collection folders with one JSON file per request, sub-folders, drag and drop, rename, duplicate,
  delete to trash.
- Save with unsaved-change tracking; open tabs restored on restart.
- Settings → Appearance: presets, colors, panel opacity, background image (fit, overlay, blur).

### 0.1.0: First release
- Request editor (methods, params, headers, body, auth), send/cancel, response viewer, tabs,
  resizable panes.

## Roadmap

- [x] Request history (last 100 requests)
- [x] Full cURL import and export
- [x] Capture response values into variables
- [x] Import Postman collections
- [x] More auth types: API Key, OAuth 2.0, Digest
- [x] Request options: timeout, follow redirects, allow self-signed certificates
- [x] Command palette, sidebar filter, find in responses
- [ ] Tests ("status is 200") and a collection runner
- [ ] Filter JSON responses by path
- [ ] Theme extras: per-method color pickers, Light / Dark / System mode, export and import themes
- [ ] Encrypt secret variables with the operating system's secure storage
- [ ] Pre-request scripts
- [x] Auto-update
- [ ] App icon

## Troubleshooting

| Problem | Fix |
|---|---|
| *"Windows protected your PC"* when installing | The app isn't signed. Click **More info → Run anyway**. |
| A collection shows *Folder not found* | The folder was moved or deleted. Right-click → **Close Collection**, then open it again from its new place. |
| Changes made outside MakiPost (e.g. `git pull`) don't show | Click **Refresh** (⟳) in the sidebar header. |
| A variable is red | It isn't defined in Globals or in the active environment. Check the dropdown in the top bar. |
| Response looks slow | Hover **Time**. If *Waiting (TTFB)* is the biggest bar, the server itself is slow. |
| A capture says "not found" | Open the **Capture** tab: the preview shows what each rule finds in the last response. Check the path matches the JSON (e.g. `body.data.token` vs `body.token`). |
| A copied cURL fails in PowerShell | In Windows PowerShell 5, `curl` means `Invoke-WebRequest`. Use the **Windows cmd** version in `cmd.exe`, or run `curl.exe` instead of `curl`. |
| *"Request timed out"* | The request's **Settings** tab has a timeout. Raise it, or pick **None**. |
| *"self-signed certificate"* / *"unable to verify"* error | For a development server, turn off **Verify SSL certificates** in the request's **Settings** tab. For a real server, fix its certificate instead. |
| OAuth sign-in window says the redirect URI is invalid | The **Callback URL** in MakiPost must exactly match one registered with your provider. |
| OAuth keeps asking you to sign in | The provider didn't return a refresh token. Many providers need the `offline_access` scope for that. |
| A Postman import says scripts were skipped | MakiPost doesn't run scripts yet. Use **Capture** for the common "save the token into a variable" script. |
| `npm run dist:win` fails with "file in use" | Close the running copy of MakiPost from `dist\`, or bump the version. |

## License

Copyright © 2026 makarasiv058@gmail.com

Released under the MIT License. See [LICENSE](LICENSE).
