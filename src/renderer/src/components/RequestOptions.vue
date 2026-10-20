<script setup>
import { computed } from 'vue'
import { DEFAULT_OPTIONS } from '@/lib/model'

const props = defineProps({ options: { type: Object, required: true } })

const PRESETS = [0, 5_000, 30_000, 60_000]
const seconds = computed({
  get: () => (props.options.timeout ? props.options.timeout / 1000 : ''),
  set: (v) => (props.options.timeout = Math.max(0, Math.round(Number(v) * 1000) || 0))
})
const isDefault = computed(() => Object.entries(DEFAULT_OPTIONS).every(([k, v]) => props.options[k] === v))
const reset = () => Object.assign(props.options, DEFAULT_OPTIONS)
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-5">
    <div class="flex items-start gap-3">
      <span class="w-40 shrink-0 pt-1.5 text-muted">Timeout</span>
      <div class="flex flex-col gap-1.5">
        <div class="flex items-center gap-2">
          <input v-model.lazy="seconds" type="number" min="0" step="1" class="input w-24" placeholder="None" />
          <span class="text-muted">seconds</span>
          <div class="ml-2 flex gap-1">
            <button
              v-for="ms in PRESETS"
              :key="ms"
              class="rounded px-2 py-0.5 text-[12px]"
              :class="options.timeout === ms ? 'bg-surface text-fg' : 'text-muted hover:text-fg'"
              @click="options.timeout = ms"
            >
              {{ ms ? `${ms / 1000}s` : 'None' }}
            </button>
          </div>
        </div>
        <span class="text-[12px] text-muted">Give up if the whole response hasn't arrived by then. Empty or 0 = wait as long as it takes.</span>
      </div>
    </div>

    <label class="flex cursor-pointer items-start gap-3">
      <span class="w-40 shrink-0 text-muted">Follow redirects</span>
      <span class="flex flex-col gap-1">
        <span class="flex items-center gap-2">
          <input v-model="options.followRedirects" type="checkbox" class="accent-[rgb(var(--sar-accent))]" />
          <span>{{ options.followRedirects ? 'On' : 'Off' }}</span>
        </span>
        <span class="text-[12px] text-muted">
          When off, you see the 3xx response itself, with its <code class="font-mono">Location</code> header.
        </span>
      </span>
    </label>

    <label class="flex cursor-pointer items-start gap-3">
      <span class="w-40 shrink-0 text-muted">Verify SSL certificates</span>
      <span class="flex flex-col gap-1">
        <span class="flex items-center gap-2">
          <input v-model="options.verifySsl" type="checkbox" class="accent-[rgb(var(--sar-accent))]" />
          <span>{{ options.verifySsl ? 'On' : 'Off' }}</span>
        </span>
        <span class="text-[12px]" :class="options.verifySsl ? 'text-muted' : 'text-warning'">
          {{
            options.verifySsl
              ? 'Turn off only for development servers with a self-signed certificate.'
              : 'Certificates are not checked for this request. Do not use this for real servers.'
          }}
        </span>
      </span>
    </label>

    <div>
      <button class="btn h-7 text-[12px]" :disabled="isDefault" @click="reset">Reset to defaults</button>
    </div>
  </div>
</template>
