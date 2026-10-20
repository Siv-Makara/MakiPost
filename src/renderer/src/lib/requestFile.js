import { createAuth, createFormRow, createRequest, createRow, DEFAULT_OPTIONS } from './model'

// Converts between the in-memory request (with row ids for Vue keys) and the
// JSON stored on disk. Row ids are dropped so files diff cleanly in Git.

const stripIds = (rows) => rows.map(({ id, ...row }) => row)

// Newer settings are only written when they differ from the defaults, so most files stay small.
const AUTH_DEFAULTS = createAuth()
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const ifChanged = (value, defaults) => (same({ ...defaults, ...value }, defaults) ? undefined : { ...defaults, ...value })

export function toFile(request) {
  const { body, auth } = request
  return {
    sar: 1,
    name: request.name,
    method: request.method,
    url: request.url,
    params: stripIds(request.params),
    headers: stripIds(request.headers),
    body: {
      mode: body.mode,
      json: body.json,
      raw: body.raw,
      rawType: body.rawType,
      formData: stripIds(body.formData),
      urlencoded: stripIds(body.urlencoded)
    },
    auth: {
      type: auth.type,
      bearer: { ...auth.bearer },
      basic: { ...auth.basic },
      apikey: ifChanged(auth.apikey, AUTH_DEFAULTS.apikey),
      digest: ifChanged(auth.digest, AUTH_DEFAULTS.digest),
      oauth2: ifChanged(auth.oauth2, AUTH_DEFAULTS.oauth2)
    },
    options: ifChanged(request.options, DEFAULT_OPTIONS),
    captures: stripIds(request.captures || [])
  }
}

export function fromFile(data = {}) {
  const base = createRequest()
  const rows = (list, make) => (Array.isArray(list) ? list.map((row) => make(row)) : [])
  return {
    ...base,
    name: data.name || base.name,
    method: (data.method || base.method).toUpperCase(),
    url: data.url || '',
    params: rows(data.params, createRow),
    headers: rows(data.headers, createRow),
    body: {
      ...base.body,
      ...data.body,
      formData: rows(data.body?.formData, createFormRow),
      urlencoded: rows(data.body?.urlencoded, createRow)
    },
    auth: {
      ...base.auth,
      ...data.auth,
      bearer: { ...base.auth.bearer, ...data.auth?.bearer },
      basic: { ...base.auth.basic, ...data.auth?.basic },
      apikey: { ...base.auth.apikey, ...data.auth?.apikey },
      digest: { ...base.auth.digest, ...data.auth?.digest },
      oauth2: { ...base.auth.oauth2, ...data.auth?.oauth2 }
    },
    options: { ...DEFAULT_OPTIONS, ...data.options },
    captures: rows(data.captures, createRow)
  }
}

/** A comparable string of everything that gets saved; used for dirty tracking. */
export const snapshot = (request) => JSON.stringify(toFile(request))
