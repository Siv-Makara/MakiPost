import { createAuth, createFormRow, createRequest, createRow, METHODS, RAW_TYPES } from './model'
import { paramsFromUrl } from './url'
import { toFile } from './requestFile'

/*
 * Postman collection (v2.0 / v2.1) -> a tree of folders and MakiPost request files.
 *
 *   { name, variables: [{ key, value, enabled }], items: [Folder | Request], notes: [string] }
 *   Folder  = { type: 'folder', name, items }
 *   Request = { type: 'request', name, data }   (data is a request file, see requestFile.js)
 *
 * Postman lets folders and the collection set auth that requests inherit; MakiPost has no
 * inheritance, so the effective auth is written into each request.
 */

export const isPostmanCollection = (data) => !!(data?.info && Array.isArray(data.item))

const LANGUAGE_TYPES = { xml: 'application/xml', html: 'text/html', javascript: 'application/javascript', text: 'text/plain' }

const str = (v) => (v == null ? '' : typeof v === 'string' ? v : typeof v === 'object' ? JSON.stringify(v) : String(v))

/** Postman 2.1 stores auth settings as [{ key, value }], 2.0 as a plain object. */
function authParams(auth, type) {
  const raw = auth?.[type]
  if (Array.isArray(raw)) return Object.fromEntries(raw.map((p) => [p.key, p.value]))
  return raw && typeof raw === 'object' ? raw : {}
}

const GRANTS = { authorization_code: 'authorization_code', authorization_code_with_pkce: 'authorization_code', client_credentials: 'client_credentials', password_credentials: 'password', password: 'password' }

function convertAuth(auth, notes, where) {
  const result = createAuth()
  if (!auth || auth.type === 'noauth') return result
  const p = authParams(auth, auth.type)
  switch (auth.type) {
    case 'bearer':
      result.type = 'bearer'
      result.bearer.token = str(p.token)
      break
    case 'basic':
      result.type = 'basic'
      result.basic = { username: str(p.username), password: str(p.password) }
      break
    case 'apikey':
      result.type = 'apikey'
      result.apikey = { key: str(p.key), value: str(p.value), in: p.in === 'query' ? 'query' : 'header' }
      break
    case 'digest':
      result.type = 'digest'
      result.digest = { username: str(p.username), password: str(p.password) }
      break
    case 'oauth2': {
      result.type = 'oauth2'
      const grant = GRANTS[p.grant_type] || 'authorization_code'
      if (p.grant_type === 'implicit') notes.add('OAuth 2.0 "Implicit" grant is not supported; those requests use Authorization Code instead.')
      Object.assign(result.oauth2, {
        grantType: grant,
        authUrl: str(p.authUrl),
        accessTokenUrl: str(p.accessTokenUrl),
        clientId: str(p.clientId),
        clientSecret: str(p.clientSecret),
        scope: str(p.scope),
        username: str(p.username),
        password: str(p.password),
        redirectUri: str(p.redirect_uri) || result.oauth2.redirectUri,
        usePkce: p.grant_type === 'authorization_code_with_pkce' || result.oauth2.usePkce,
        clientAuth: p.client_authentication === 'header' ? 'header' : 'body',
        headerPrefix: p.headerPrefix != null ? str(p.headerPrefix) : 'Bearer'
      })
      break
    }
    default:
      notes.add(`"${auth.type}" auth is not supported yet (${where}); those requests were imported with no auth.`)
  }
  return result
}

/** Postman URL (string or object) -> URL string with {{variables}} kept as-is. */
function convertUrl(url) {
  if (!url) return { raw: '', disabledQuery: [] }
  if (typeof url === 'string') return { raw: url, disabledQuery: [] }
  let raw = url.raw
  if (!raw) {
    const host = Array.isArray(url.host) ? url.host.join('.') : str(url.host)
    const path = Array.isArray(url.path) ? url.path.join('/') : str(url.path)
    const query = (url.query || []).filter((q) => !q.disabled).map((q) => `${q.key ?? ''}=${q.value ?? ''}`)
    raw = `${url.protocol ? `${url.protocol}://` : ''}${host}${url.port ? `:${url.port}` : ''}${path ? `/${path.replace(/^\//, '')}` : ''}${query.length ? `?${query.join('&')}` : ''}`
  }
  // Path variables (/users/:id) become their value when Postman has one.
  for (const v of url.variable || []) {
    if (v?.key && v.value != null && v.value !== '') {
      raw = raw.replace(new RegExp(`/:${v.key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[/?#]|$)`, 'g'), `/${v.value}`)
    }
  }
  const disabledQuery = (url.query || []).filter((q) => q.disabled && q.key)
  return { raw, disabledQuery }
}

function convertBody(body, request, headers, notes) {
  if (!body || body.disabled) return
  switch (body.mode) {
    case 'raw': {
      const text = str(body.raw)
      if (!text) return
      const language = body.options?.raw?.language
      const contentType = (headers.find((h) => h.key.toLowerCase() === 'content-type')?.value || '').toLowerCase()
      if (language === 'json' || (!language && (contentType.includes('json') || /^\s*[[{]/.test(text)))) {
        request.body.mode = 'json'
        request.body.json = text
      } else {
        request.body.mode = 'raw'
        request.body.raw = text
        request.body.rawType =
          LANGUAGE_TYPES[language] || RAW_TYPES.find((t) => contentType.startsWith(t.id))?.id || 'text/plain'
      }
      break
    }
    case 'urlencoded':
      request.body.mode = 'urlencoded'
      request.body.urlencoded = (body.urlencoded || []).map((r) =>
        createRow({ key: str(r.key), value: str(r.value), enabled: !r.disabled })
      )
      break
    case 'formdata':
      request.body.mode = 'form-data'
      request.body.formData = (body.formdata || []).map((r) => {
        if (r.type === 'file') {
          const src = Array.isArray(r.src) ? r.src[0] : r.src
          return createFormRow({ key: str(r.key), type: 'file', path: str(src), enabled: !r.disabled })
        }
        return createFormRow({ key: str(r.key), value: str(r.value), enabled: !r.disabled })
      })
      break
    case 'graphql': {
      const gql = body.graphql || {}
      let variables
      try {
        variables = gql.variables ? JSON.parse(gql.variables) : undefined
      } catch {
        variables = undefined
      }
      request.body.mode = 'json'
      request.body.json = JSON.stringify({ query: str(gql.query), ...(variables && { variables }) }, null, 2)
      break
    }
    case 'file':
      notes.add('Binary file bodies are not supported yet; those requests were imported without a body.')
      break
  }
}

function convertRequest(item, inheritedAuth, notes) {
  const source = typeof item.request === 'string' ? { url: item.request } : item.request || {}
  const method = str(source.method || 'GET').toUpperCase()
  if (!METHODS.includes(method)) notes.add(`The ${method} method is not supported; those requests were imported as GET.`)

  const { raw, disabledQuery } = convertUrl(source.url)
  const headers = (Array.isArray(source.header) ? source.header : []).map((h) =>
    createRow({ key: str(h.key), value: str(h.value), enabled: !h.disabled })
  )
  const request = createRequest({
    name: str(item.name) || 'Untitled Request',
    method: METHODS.includes(method) ? method : 'GET',
    url: raw,
    params: [
      ...paramsFromUrl(raw),
      ...disabledQuery.map((q) => createRow({ key: str(q.key), value: str(q.value), enabled: false }))
    ],
    headers
  })
  // No auth on the request means "inherit from parent" in Postman.
  request.auth = source.auth ? convertAuth(source.auth, notes, `request "${request.name}"`) : inheritedAuth
  convertBody(source.body, request, headers, notes)
  return { type: 'request', name: request.name, data: toFile(request) }
}

const countScripts = (node) => (node.event || []).filter((e) => e.script?.exec?.length && [].concat(e.script.exec).join('').trim()).length

function convertItems(items, inheritedAuth, notes, stats) {
  const out = []
  for (const item of items || []) {
    stats.scripts += countScripts(item)
    if (Array.isArray(item.item)) {
      const auth = item.auth ? convertAuth(item.auth, notes, `folder "${item.name}"`) : inheritedAuth
      out.push({ type: 'folder', name: str(item.name) || 'Folder', items: convertItems(item.item, auth, notes, stats) })
      stats.folders++
    } else if (item.request != null) {
      out.push(convertRequest(item, inheritedAuth, notes))
      stats.requests++
    }
  }
  return out
}

/** Convert a parsed Postman collection file. Throws a friendly error for other files. */
export function convertPostmanCollection(data) {
  if (data?.values && data?.name && !data.item) {
    throw new Error('This is a Postman environment, not a collection. Import it from Manage Environments instead.')
  }
  if (Array.isArray(data?.requests) && !data.item) {
    throw new Error('This is a Postman v1 collection. In Postman, export it again as "Collection v2.1".')
  }
  if (!isPostmanCollection(data)) throw new Error('This file is not a Postman collection (v2.0 or v2.1).')

  const notes = new Set()
  const stats = { requests: 0, folders: 0, scripts: countScripts(data) }
  const rootAuth = convertAuth(data.auth, notes, 'collection')
  const items = convertItems(data.item, rootAuth, notes, stats)
  if (stats.scripts) {
    notes.add(`${stats.scripts} pre-request/test script${stats.scripts === 1 ? ' was' : 's were'} skipped (MakiPost doesn't run scripts yet).`)
  }
  return {
    name: str(data.info.name) || 'Imported collection',
    variables: (data.variable || [])
      .filter((v) => v?.key)
      .map((v) => ({ key: str(v.key), value: str(v.value), enabled: !v.disabled })),
    items,
    stats,
    notes: [...notes]
  }
}
