export const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

export const BODY_MODES = [
  { id: 'none', label: 'None' },
  { id: 'json', label: 'JSON' },
  { id: 'form-data', label: 'Form Data' },
  { id: 'urlencoded', label: 'x-www-form-urlencoded' },
  { id: 'raw', label: 'Raw' }
]

export const RAW_TYPES = [
  { id: 'text/plain', label: 'Text' },
  { id: 'application/xml', label: 'XML' },
  { id: 'text/html', label: 'HTML' },
  { id: 'application/javascript', label: 'JavaScript' }
]

export const AUTH_TYPES = [
  { id: 'none', label: 'No Auth' },
  { id: 'bearer', label: 'Bearer Token' },
  { id: 'basic', label: 'Basic Auth' },
  { id: 'apikey', label: 'API Key' },
  { id: 'digest', label: 'Digest Auth' },
  { id: 'oauth2', label: 'OAuth 2.0' }
]

export const OAUTH_GRANTS = [
  { id: 'authorization_code', label: 'Authorization Code' },
  { id: 'client_credentials', label: 'Client Credentials' },
  { id: 'password', label: 'Password' }
]

/** Per-request options. `timeout` is in milliseconds; 0 means no limit. */
export const DEFAULT_OPTIONS = { timeout: 0, followRedirects: true, verifySsl: true }

export function createAuth() {
  return {
    type: 'none',
    bearer: { token: '' },
    basic: { username: '', password: '' },
    apikey: { key: '', value: '', in: 'header' },
    digest: { username: '', password: '' },
    // Tokens are not stored here (so they never land in Git); see src/main/oauth.js.
    oauth2: {
      grantType: 'authorization_code',
      authUrl: '',
      accessTokenUrl: '',
      clientId: '',
      clientSecret: '',
      scope: '',
      username: '',
      password: '',
      redirectUri: 'http://localhost:8765/callback',
      usePkce: true,
      clientAuth: 'body',
      headerPrefix: 'Bearer'
    }
  }
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

export function createRow(partial = {}) {
  return { id: uid(), key: '', value: '', enabled: true, ...partial }
}

export function createFormRow(partial = {}) {
  return { ...createRow(), type: 'text', path: '', ...partial }
}

/** A request as it is edited (and, from stage 2, saved to disk). */
export function createRequest(partial = {}) {
  return {
    id: uid(),
    name: 'Untitled Request',
    method: 'GET',
    url: '',
    params: [],
    headers: [],
    body: {
      mode: 'none',
      json: '',
      raw: '',
      rawType: 'text/plain',
      formData: [],
      urlencoded: []
    },
    auth: createAuth(),
    options: { ...DEFAULT_OPTIONS },
    // After a response: save values from it into environment variables ({ key: var name, value: expression }).
    captures: [],
    ...partial
  }
}
