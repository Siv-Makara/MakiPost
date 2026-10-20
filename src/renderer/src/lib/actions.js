import { useEnvironmentsStore } from '@/stores/environments'
import { useUiStore } from '@/stores/ui'
import { buildRequest } from './buildRequest'
import { toCurl } from './curl'
import { resolveOAuthConfig } from './oauth'

export const SHELL_LABEL = { bash: 'bash', cmd: 'Windows cmd' }

/** Copy a request as a cURL command, with variables from the active environment filled in. */
export async function copyAsCurl(request, shell = 'bash') {
  const env = useEnvironmentsStore()
  const resolve = (text) => env.resolve(text)
  // Uses the OAuth token MakiPost already has (if any); copying never opens a sign-in window.
  const oauthToken =
    request.auth.type === 'oauth2'
      ? await window.sar.oauth.peek(resolveOAuthConfig(JSON.parse(JSON.stringify(request.auth.oauth2)), resolve)).catch(() => null)
      : null
  const built = buildRequest(JSON.parse(JSON.stringify(request)), resolve, { oauthToken })
  await navigator.clipboard.writeText(toCurl(built, shell))
  useUiStore().toast(`Copied as cURL (${SHELL_LABEL[shell]})`)
}

/** Context-menu items for both cURL flavours. */
export const curlMenuItems = (getRequest) => [
  { label: 'Copy as cURL (bash)', action: async () => copyAsCurl(await getRequest(), 'bash') },
  { label: 'Copy as cURL (Windows cmd)', action: async () => copyAsCurl(await getRequest(), 'cmd') }
]
