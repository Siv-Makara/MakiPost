<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { AUTH_TYPES, OAUTH_GRANTS } from '@/lib/model'
import { resolveOAuthConfig } from '@/lib/oauth'
import { useEnvironmentsStore } from '@/stores/environments'
import { cleanError, useUiStore } from '@/stores/ui'
import VarInput from './VarInput.vue'

const props = defineProps({ auth: { type: Object, required: true } })
const showSecret = ref(false)
const env = useEnvironmentsStore()
const ui = useUiStore()

const secretType = computed(() => (showSecret.value ? 'text' : 'password'))
const o = computed(() => props.auth.oauth2)
const needsBrowser = computed(() => o.value.grantType === 'authorization_code')

// --- OAuth 2.0 token status ------------------------------------------------------------

const token = ref(null)
const tokenBusy = ref(false)
const tokenError = ref('')
const now = ref(Date.now())
const clock = setInterval(() => (now.value = Date.now()), 15_000)
onBeforeUnmount(() => clearInterval(clock))

const config = () => resolveOAuthConfig(JSON.parse(JSON.stringify(o.value)), (text) => env.resolve(text))

let peekTimer = null
watch(
  () => props.auth.type === 'oauth2' && JSON.stringify([o.value, env.names, env.activeId]),
  (watching) => {
    clearTimeout(peekTimer)
    if (!watching) return
    peekTimer = setTimeout(async () => {
      token.value = await window.sar.oauth.peek(config()).catch(() => null)
    }, 250)
  },
  { immediate: true }
)

const tokenState = computed(() => {
  const t = token.value
  if (!t) return { tone: 'muted', text: 'No token yet. One is fetched automatically when you send the request.' }
  if (t.expiresAt && t.expiresAt <= now.value) {
    return { tone: 'warning', text: t.hasRefreshToken ? 'Expired. It will be refreshed when you send.' : 'Expired. A new one is fetched when you send.' }
  }
  if (!t.expiresAt) return { tone: 'success', text: 'Valid (no expiry given by the server)' }
  const mins = Math.round((t.expiresAt - now.value) / 60_000)
  const left = mins < 1 ? 'less than a minute' : mins < 120 ? `${mins} min` : `${Math.round(mins / 60)} h`
  return { tone: 'success', text: `Valid for ${left}${t.hasRefreshToken ? ' · auto-refreshes' : ''}` }
})

async function getNewToken() {
  tokenBusy.value = true
  tokenError.value = ''
  try {
    token.value = await window.sar.oauth.getToken(config(), true)
    ui.toast('Got a new access token')
  } catch (err) {
    tokenError.value = cleanError(err)
  } finally {
    tokenBusy.value = false
  }
}

async function clearToken() {
  await window.sar.oauth.clear(config())
  token.value = null
}

async function copyToken() {
  await navigator.clipboard.writeText(token.value.accessToken)
  ui.toast('Access token copied')
}

const preview = (t) => (t.length > 48 ? `${t.slice(0, 24)}…${t.slice(-12)}` : t)
const toneClass = { success: 'text-success', warning: 'text-warning', muted: 'text-muted' }
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-3">
    <div class="flex items-center gap-3">
      <span class="w-32 shrink-0 text-muted">Type</span>
      <select v-model="auth.type" class="select w-48">
        <option v-for="a in AUTH_TYPES" :key="a.id" :value="a.id">{{ a.label }}</option>
      </select>
    </div>

    <p v-if="auth.type === 'none'" class="text-muted">This request does not use any authorization.</p>

    <!-- Bearer -->
    <div v-else-if="auth.type === 'bearer'" class="flex items-center gap-3">
      <span class="w-32 shrink-0 text-muted">Token</span>
      <VarInput
        v-model="auth.bearer.token"
        wrapper-class="flex-1"
        input-class="input font-mono text-[12px]"
        :type="secretType"
        placeholder="{{token}} or eyJhbGciOi…"
      />
    </div>

    <!-- Basic / Digest share the same fields -->
    <template v-else-if="auth.type === 'basic' || auth.type === 'digest'">
      <div class="flex items-center gap-3">
        <span class="w-32 shrink-0 text-muted">Username</span>
        <VarInput v-model="auth[auth.type].username" wrapper-class="flex-1" input-class="input" />
      </div>
      <div class="flex items-center gap-3">
        <span class="w-32 shrink-0 text-muted">Password</span>
        <VarInput v-model="auth[auth.type].password" wrapper-class="flex-1" input-class="input" :type="secretType" />
      </div>
    </template>

    <!-- API key -->
    <template v-else-if="auth.type === 'apikey'">
      <div class="flex items-center gap-3">
        <span class="w-32 shrink-0 text-muted">Key</span>
        <VarInput v-model="auth.apikey.key" wrapper-class="flex-1" input-class="input font-mono text-[12px]" placeholder="X-Api-Key" />
      </div>
      <div class="flex items-center gap-3">
        <span class="w-32 shrink-0 text-muted">Value</span>
        <VarInput
          v-model="auth.apikey.value"
          wrapper-class="flex-1"
          input-class="input font-mono text-[12px]"
          :type="secretType"
          placeholder="{{apiKey}}"
        />
      </div>
      <div class="flex items-center gap-3">
        <span class="w-32 shrink-0 text-muted">Add to</span>
        <select v-model="auth.apikey.in" class="select w-48">
          <option value="header">Header</option>
          <option value="query">Query params</option>
        </select>
      </div>
    </template>

    <!-- OAuth 2.0 -->
    <template v-else-if="auth.type === 'oauth2'">
      <div class="flex items-center gap-3">
        <span class="w-32 shrink-0 text-muted">Grant type</span>
        <select v-model="o.grantType" class="select w-56">
          <option v-for="g in OAUTH_GRANTS" :key="g.id" :value="g.id">{{ g.label }}</option>
        </select>
      </div>
      <div v-if="needsBrowser" class="flex items-center gap-3">
        <span class="w-32 shrink-0 text-muted">Auth URL</span>
        <VarInput v-model="o.authUrl" wrapper-class="flex-1" input-class="input font-mono text-[12px]" placeholder="https://example.com/oauth/authorize" />
      </div>
      <div class="flex items-center gap-3">
        <span class="w-32 shrink-0 text-muted">Access Token URL</span>
        <VarInput v-model="o.accessTokenUrl" wrapper-class="flex-1" input-class="input font-mono text-[12px]" placeholder="https://example.com/oauth/token" />
      </div>
      <div class="flex items-center gap-3">
        <span class="w-32 shrink-0 text-muted">Client ID</span>
        <VarInput v-model="o.clientId" wrapper-class="flex-1" input-class="input font-mono text-[12px]" />
      </div>
      <div class="flex items-center gap-3">
        <span class="w-32 shrink-0 text-muted">Client Secret</span>
        <VarInput
          v-model="o.clientSecret"
          wrapper-class="flex-1"
          input-class="input font-mono text-[12px]"
          :type="secretType"
          :placeholder="needsBrowser && o.usePkce ? 'Optional with PKCE' : ''"
        />
      </div>
      <template v-if="o.grantType === 'password'">
        <div class="flex items-center gap-3">
          <span class="w-32 shrink-0 text-muted">Username</span>
          <VarInput v-model="o.username" wrapper-class="flex-1" input-class="input" />
        </div>
        <div class="flex items-center gap-3">
          <span class="w-32 shrink-0 text-muted">Password</span>
          <VarInput v-model="o.password" wrapper-class="flex-1" input-class="input" :type="secretType" />
        </div>
      </template>
      <div v-if="needsBrowser" class="flex items-center gap-3">
        <span class="w-32 shrink-0 text-muted">Callback URL</span>
        <VarInput v-model="o.redirectUri" wrapper-class="flex-1" input-class="input font-mono text-[12px]" />
      </div>
      <div class="flex items-center gap-3">
        <span class="w-32 shrink-0 text-muted">Scope</span>
        <VarInput v-model="o.scope" wrapper-class="flex-1" input-class="input font-mono text-[12px]" placeholder="read write (optional)" />
      </div>

      <details class="group rounded-md border border-line">
        <summary class="cursor-pointer select-none px-3 py-1.5 text-[12px] text-muted hover:text-fg">Advanced</summary>
        <div class="flex flex-col gap-3 border-t border-line p-3">
          <div class="flex items-center gap-3">
            <span class="w-32 shrink-0 text-muted">Client auth</span>
            <select v-model="o.clientAuth" class="select w-64">
              <option value="body">Send client credentials in body</option>
              <option value="header">Send as Basic Auth header</option>
            </select>
          </div>
          <div class="flex items-center gap-3">
            <span class="w-32 shrink-0 text-muted">Header prefix</span>
            <input v-model="o.headerPrefix" class="input w-40 font-mono text-[12px]" placeholder="Bearer" />
          </div>
          <label v-if="needsBrowser" class="flex cursor-pointer items-center gap-2 pl-[140px] text-[12px] text-muted">
            <input v-model="o.usePkce" type="checkbox" class="accent-[rgb(var(--sar-accent))]" />
            Use PKCE (recommended)
          </label>
        </div>
      </details>

      <!-- Token -->
      <div class="rounded-md border border-line p-3">
        <div class="flex items-center gap-2">
          <span class="text-[11px] font-semibold uppercase tracking-wider text-muted">Access token</span>
          <span class="text-[12px]" :class="toneClass[tokenState.tone]">{{ tokenState.text }}</span>
        </div>
        <div v-if="token" class="mt-2 flex items-center gap-2">
          <code class="min-w-0 flex-1 truncate rounded bg-surface/60 px-2 py-1 font-mono text-[11.5px] text-fg/90" :title="showSecret ? token.accessToken : ''">
            {{ showSecret ? preview(token.accessToken) : '••••••••••••••••' }}
          </code>
          <button class="btn-ghost text-[12px]" @click="copyToken">Copy</button>
          <button class="btn-ghost text-[12px]" @click="clearToken">Clear</button>
        </div>
        <div class="mt-2 flex items-center gap-2">
          <button class="btn h-7 text-[12px]" :disabled="tokenBusy" @click="getNewToken">
            {{ tokenBusy ? (needsBrowser ? 'Waiting for sign-in…' : 'Getting token…') : 'Get New Access Token' }}
          </button>
          <span v-if="needsBrowser && !tokenBusy" class="text-[11.5px] text-muted">Opens a sign-in window.</span>
        </div>
        <p v-if="tokenError" class="mt-2 select-text text-[12px] text-danger">{{ tokenError }}</p>
      </div>
    </template>

    <label v-if="auth.type !== 'none'" class="flex cursor-pointer items-center gap-2 pl-[140px] text-[12px] text-muted">
      <input v-model="showSecret" type="checkbox" class="accent-[rgb(var(--sar-accent))]" />
      Show secrets
    </label>

    <p v-if="auth.type === 'digest'" class="text-[12px] text-muted">
      MakiPost sends the request, reads the server's Digest challenge from the 401 response, and sends it again with the
      answer (MD5 or SHA-256).
    </p>
    <p v-else-if="auth.type === 'oauth2'" class="text-[12px] leading-relaxed text-muted">
      Tokens are kept by MakiPost (encrypted where your system supports it), not in the request file, so they never end up in
      Git. Requests with the same OAuth settings share one token. For <i>Authorization Code</i>, register the Callback
      URL with your provider; MakiPost catches the redirect itself, so nothing needs to run there.
    </p>
    <p v-else-if="auth.type !== 'none'" class="text-[12px] text-muted">
      You can use environment variables like <code v-pre class="font-mono">{{token}}</code>.
      <template v-if="auth.type !== 'apikey'">
        The <code class="font-mono">Authorization</code> header is generated when the request is sent, unless you set one
        yourself in Headers.
      </template>
    </p>
  </div>
</template>
