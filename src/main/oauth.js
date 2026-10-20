import { BrowserWindow, ipcMain, safeStorage } from 'electron'
import { createHash, randomBytes } from 'node:crypto'
import Store from 'electron-store'
import { fetch } from 'undici'

/*
 * OAuth 2.0 tokens. They are kept here, not in the request files, so they never end
 * up in Git. Tokens are cached per OAuth configuration (token URL + client + scope …),
 * so every request that shares a configuration shares its token. Where the OS offers
 * it (Windows DPAPI, macOS Keychain, Linux secret service) they are encrypted at rest.
 */

const tokenStore = new Store({ name: 'sar-oauth', defaults: { tokens: {} } })
const EXPIRY_MARGIN = 30_000 // refresh a little before the server would reject the token

const base64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

function keyOf(config) {
  const identity = [config.grantType, config.accessTokenUrl, config.authUrl, config.clientId, config.scope, config.username]
  return createHash('sha256').update(JSON.stringify(identity)).digest('hex').slice(0, 32)
}

function load(key) {
  const entry = tokenStore.get('tokens')[key]
  if (!entry) return null
  try {
    const json = entry.enc ? safeStorage.decryptString(Buffer.from(entry.enc, 'base64')) : entry.plain
    return JSON.parse(json)
  } catch {
    return null // e.g. encrypted under a different OS user
  }
}

function save(key, token) {
  const json = JSON.stringify(token)
  const entry = safeStorage.isEncryptionAvailable()
    ? { enc: safeStorage.encryptString(json).toString('base64') }
    : { plain: json }
  tokenStore.set('tokens', { ...tokenStore.get('tokens'), [key]: entry })
}

function clear(key) {
  const { [key]: _removed, ...rest } = tokenStore.get('tokens')
  tokenStore.set('tokens', rest)
}

const isFresh = (token) => token && (!token.expiresAt || token.expiresAt - EXPIRY_MARGIN > Date.now())

/** What the renderer gets to see. */
const publicToken = (token) =>
  token && {
    accessToken: token.accessToken,
    tokenType: token.tokenType,
    expiresAt: token.expiresAt,
    obtainedAt: token.obtainedAt,
    scope: token.scope,
    hasRefreshToken: !!token.refreshToken
  }

function assertHttpUrl(value, label) {
  let url
  try {
    url = new URL(value)
  } catch {
    throw new Error(`${label} is missing or not a valid URL.`)
  }
  if (!/^https?:$/.test(url.protocol)) throw new Error(`${label} must start with http:// or https://`)
  return url
}

// --- token endpoint ----------------------------------------------------------------------

async function requestToken(config, params) {
  const tokenUrl = assertHttpUrl(config.accessTokenUrl, 'Access Token URL')
  const body = new URLSearchParams(params)
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }
  if (config.clientAuth === 'header') {
    headers.Authorization = `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`
  } else {
    if (config.clientId) body.set('client_id', config.clientId)
    if (config.clientSecret) body.set('client_secret', config.clientSecret)
  }

  let res
  try {
    res = await fetch(tokenUrl, { method: 'POST', headers, body: body.toString(), signal: AbortSignal.timeout(30_000) })
  } catch (err) {
    throw new Error(`Could not reach the token URL: ${err.cause?.code || err.cause?.message || err.message}`)
  }
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    data = Object.fromEntries(new URLSearchParams(text)) // e.g. GitHub without Accept: json
  }
  if (!res.ok || data.error || !data.access_token) {
    const reason = data.error_description || data.error || (text ? text.slice(0, 200) : '')
    throw new Error(`The server refused the token request (HTTP ${res.status})${reason ? `: ${reason}` : ''}`)
  }
  const expiresIn = Number(data.expires_in)
  return {
    accessToken: String(data.access_token),
    tokenType: data.token_type || 'Bearer',
    refreshToken: data.refresh_token || null,
    expiresAt: expiresIn > 0 ? Date.now() + expiresIn * 1000 : null,
    obtainedAt: Date.now(),
    scope: data.scope || config.scope || ''
  }
}

// --- authorization code (+ PKCE) in a sign-in window ---------------------------------------

function authorizeInWindow(parent, config) {
  const authUrl = assertHttpUrl(config.authUrl, 'Auth URL')
  const redirect = assertHttpUrl(config.redirectUri, 'Callback URL')
  const verifier = base64url(randomBytes(32))
  const state = base64url(randomBytes(16))

  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', config.clientId)
  authUrl.searchParams.set('redirect_uri', config.redirectUri)
  authUrl.searchParams.set('state', state)
  if (config.scope) authUrl.searchParams.set('scope', config.scope)
  if (config.usePkce) {
    authUrl.searchParams.set('code_challenge', base64url(createHash('sha256').update(verifier).digest()))
    authUrl.searchParams.set('code_challenge_method', 'S256')
  }

  const isCallback = (value) => {
    try {
      const url = new URL(value)
      return url.origin === redirect.origin && url.pathname.replace(/\/$/, '') === redirect.pathname.replace(/\/$/, '')
    } catch {
      return false
    }
  }

  return new Promise((resolve, reject) => {
    const win = new BrowserWindow({
      parent,
      width: 560,
      height: 720,
      title: 'Sign in',
      autoHideMenuBar: true,
      // A persistent session, so "remember me" on the provider's login page keeps working.
      webPreferences: { partition: 'persist:sar-oauth', contextIsolation: true, nodeIntegration: false, sandbox: true }
    })
    let done = false
    const finish = (fn) => {
      if (done) return
      done = true
      fn()
      if (!win.isDestroyed()) win.close()
    }

    const onUrl = (event, value) => {
      if (!isCallback(value)) return
      event?.preventDefault?.()
      const params = new URL(value).searchParams
      if (params.get('error')) {
        const reason = params.get('error_description') || params.get('error')
        return finish(() => reject(new Error(`Sign-in failed: ${reason}`)))
      }
      if (params.get('state') !== state) return finish(() => reject(new Error('Sign-in failed: the state did not match.')))
      const code = params.get('code')
      if (!code) return finish(() => reject(new Error('Sign-in failed: no authorization code was returned.')))
      finish(() => resolve({ code, verifier }))
    }

    win.webContents.on('will-redirect', onUrl)
    win.webContents.on('will-navigate', onUrl)
    // If the callback URL was loaded anyway (nothing listens there), it fails; catch it here.
    win.webContents.on('did-fail-load', (_e, _code, _desc, url) => onUrl(null, url))
    win.webContents.on('did-navigate', (_e, url) => onUrl(null, url))
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    win.on('closed', () => finish(() => reject(new Error('The sign-in window was closed before signing in.'))))
    win.loadURL(authUrl.toString()).catch(() => {
      /* reported through did-fail-load */
    })
  })
}

// --- getting a token -------------------------------------------------------------------------

const pending = new Map() // key -> promise, so two sends at once don't open two sign-in windows

async function fetchToken(parent, config, key) {
  const cached = load(key)
  if (cached?.refreshToken) {
    try {
      const token = await requestToken(config, { grant_type: 'refresh_token', refresh_token: cached.refreshToken })
      token.refreshToken ||= cached.refreshToken
      return token
    } catch {
      /* refresh token expired or revoked: get a new one below */
    }
  }
  switch (config.grantType) {
    case 'client_credentials':
      return requestToken(config, { grant_type: 'client_credentials', ...(config.scope && { scope: config.scope }) })
    case 'password':
      return requestToken(config, {
        grant_type: 'password',
        username: config.username,
        password: config.password,
        ...(config.scope && { scope: config.scope })
      })
    case 'authorization_code': {
      const { code, verifier } = await authorizeInWindow(parent, config)
      return requestToken(config, {
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri,
        ...(config.usePkce && { code_verifier: verifier })
      })
    }
    default:
      throw new Error(`Unsupported grant type: ${config.grantType}`)
  }
}

/** A valid token for this configuration: cached, refreshed, or newly obtained. */
async function getToken(parent, config, force = false) {
  const key = keyOf(config)
  if (!force) {
    const cached = load(key)
    if (isFresh(cached)) return publicToken(cached)
  }
  if (!pending.has(key)) {
    const job = (async () => {
      if (force) {
        const cached = load(key)
        if (cached) save(key, { ...cached, expiresAt: 1 }) // expired: keeps the refresh token, drops the access token
      }
      const token = await fetchToken(parent, config, key)
      save(key, token)
      return token
    })().finally(() => pending.delete(key))
    pending.set(key, job)
  }
  return publicToken(await pending.get(key))
}

export function registerOAuthIpc() {
  const win = (e) => BrowserWindow.fromWebContents(e.sender)
  ipcMain.handle('oauth:getToken', (e, config, force) => getToken(win(e), config, !!force))
  ipcMain.handle('oauth:peek', (_e, config) => publicToken(load(keyOf(config))))
  ipcMain.handle('oauth:clear', (_e, config) => clear(keyOf(config)))
}
