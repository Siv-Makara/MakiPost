// The OAuth 2.0 settings with {{variables}} filled in, as sent to the main process
// (which fetches, caches and refreshes the tokens: see src/main/oauth.js).
export function resolveOAuthConfig(oauth2, resolve) {
  const out = {}
  for (const [key, value] of Object.entries(oauth2)) out[key] = typeof value === 'string' ? resolve(value).trim() : value
  return out
}
