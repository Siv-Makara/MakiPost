import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { createRow, uid } from '@/lib/model'
import { DYNAMIC_VARS, interpolate, isDynamic } from '@/lib/variables'

export const GLOBALS_ID = 'globals'

const clone = (v) => JSON.parse(JSON.stringify(v))

const normalizeRow = (row = {}) =>
  createRow({
    key: String(row.key ?? ''),
    value: String(row.value ?? ''),
    enabled: row.enabled !== false,
    secret: !!row.secret
  })

const normalizeEnv = (env = {}) => ({
  id: env.id || uid(),
  name: String(env.name || 'Environment'),
  variables: (env.variables || []).map(normalizeRow)
})

export const useEnvironmentsStore = defineStore('environments', () => {
  const globals = ref([])
  const list = ref([])
  const activeId = ref(null)

  const active = computed(() => list.value.find((e) => e.id === activeId.value) || null)

  /** name -> { value, source, secret }. The active environment overrides Globals. */
  const table = computed(() => {
    const map = new Map()
    const add = (rows, source) => {
      for (const r of rows) if (r.enabled && r.key.trim()) map.set(r.key.trim(), { value: r.value, source, secret: r.secret })
    }
    add(globals.value, 'Globals')
    if (active.value) add(active.value.variables, active.value.name)
    return map
  })

  const names = computed(() => [...table.value.keys()])

  const lookup = (name) => table.value.get(name)?.value ?? null
  const isDefined = (name) => isDynamic(name) || table.value.has(name)

  function describe(name) {
    const dyn = DYNAMIC_VARS.find((d) => d.name === name)
    if (dyn) return { value: dyn.description, source: 'Dynamic', secret: false }
    return table.value.get(name) || null
  }

  /** Suggestions for autocomplete: defined variables first, then dynamic ones. */
  function suggestions(query = '') {
    const q = query.toLowerCase()
    const items = [
      ...names.value.map((name) => ({ name, ...table.value.get(name) })),
      ...DYNAMIC_VARS.map((d) => ({ name: d.name, value: d.description, source: 'Dynamic' }))
    ].filter((i) => i.name.toLowerCase().includes(q))
    return items.sort((a, b) => b.name.toLowerCase().startsWith(q) - a.name.toLowerCase().startsWith(q))
  }

  const resolve = (text, missing) => interpolate(text, lookup, missing)

  // --- persistence ------------------------------------------------------------

  function init(saved) {
    globals.value = (saved?.globals || []).map(normalizeRow)
    list.value = (saved?.list || []).map(normalizeEnv)
    activeId.value = list.value.some((e) => e.id === saved?.activeId) ? saved.activeId : null

    let timer = null
    watch(
      [globals, list, activeId],
      () => {
        clearTimeout(timer)
        timer = setTimeout(() => {
          window.sar.settings.set('environments', clone({ globals: globals.value, list: list.value, activeId: activeId.value }))
        }, 300)
      },
      { deep: true }
    )
  }

  // --- editing ----------------------------------------------------------------

  function create(name = 'New Environment', variables = []) {
    const env = normalizeEnv({ name, variables })
    list.value.push(env)
    return env
  }

  function duplicate(env) {
    const copy = normalizeEnv({ name: `${env.name} copy`, variables: clone(env.variables) })
    list.value.splice(list.value.indexOf(env) + 1, 0, copy)
    return copy
  }

  /**
   * Set a variable in the active environment (or Globals when none is active),
   * creating it if needed. Returns the name of the place it was written to.
   */
  function setVariable(name, value) {
    const rows = active.value ? active.value.variables : globals.value
    const row = rows.find((r) => r.key.trim() === name)
    if (row) {
      row.value = value
      row.enabled = true
    } else {
      rows.push(normalizeRow({ key: name, value, secret: /token|secret|password|passwd|api[-_]?key/i.test(name) }))
    }
    return active.value ? active.value.name : 'Globals'
  }

  function remove(env) {
    list.value = list.value.filter((e) => e.id !== env.id)
    if (activeId.value === env.id) activeId.value = null
  }

  // --- import / export (Postman environment format) ---------------------------

  function exportData(env) {
    return {
      name: env.name,
      values: env.variables
        .filter((v) => v.key)
        .map((v) => ({ key: v.key, value: v.value, enabled: v.enabled, type: v.secret ? 'secret' : 'default' })),
      _sar: 1
    }
  }

  /** Accepts a Postman/MakiPost environment, or an array of them. Returns the imported environments. */
  function importData(data, fallbackName = 'Imported') {
    const items = Array.isArray(data) ? data : [data]
    const imported = []
    for (const item of items) {
      const values = item?.values || item?.variables
      if (!Array.isArray(values)) throw new Error('This file is not an environment (expected a "values" list).')
      imported.push(
        create(
          item.name || fallbackName,
          values.map((v) => ({ key: v.key, value: v.value, enabled: v.enabled !== false, secret: v.type === 'secret' || v.secret }))
        )
      )
    }
    return imported
  }

  return {
    globals,
    list,
    activeId,
    active,
    table,
    names,
    isDefined,
    describe,
    suggestions,
    resolve,
    init,
    create,
    duplicate,
    setVariable,
    remove,
    exportData,
    importData
  }
})
