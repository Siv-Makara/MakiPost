<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { EditorView, basicSetup } from 'codemirror'
import { Compartment, EditorState } from '@codemirror/state'
import { Decoration, MatchDecorator, ViewPlugin, hoverTooltip, keymap, placeholder as cmPlaceholder } from '@codemirror/view'
import { useEnvironmentsStore } from '@/stores/environments'
import { varRegex } from '@/lib/variables'
import { indentWithTab } from '@codemirror/commands'
import { openSearchPanel } from '@codemirror/search'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import { json } from '@codemirror/lang-json'
import { html } from '@codemirror/lang-html'
import { xml } from '@codemirror/lang-xml'

const props = defineProps({
  modelValue: { type: String, default: '' },
  language: { type: String, default: 'text' },
  readonly: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
  // Highlight, explain and autocomplete {{environment variables}}.
  variables: { type: Boolean, default: false },
  // Soft-wrap long lines. Turned off for very large documents, where wrapping is slow.
  wrap: { type: Boolean, default: true }
})
const emit = defineEmits(['update:modelValue'])

const host = ref(null)
let view = null
const languageConf = new Compartment()
const readonlyConf = new Compartment()
const variablesConf = new Compartment()
const wrapConf = new Compartment()
const wrapExt = (on) => (on ? EditorView.lineWrapping : [])
const env = useEnvironmentsStore()

const languages = { json, html, xml }
const languageExt = (id) => (languages[id] ? languages[id]() : [])

const c = (name, alpha) => (alpha == null ? `rgb(var(--sar-${name}))` : `rgb(var(--sar-${name}) / ${alpha})`)

// All colors come from CSS variables, so switching themes needs no editor reconfiguration.
const sarTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '12.5px', backgroundColor: 'transparent', color: c('text') },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--sar-font-mono)', lineHeight: '1.6' },
  '.cm-content': { caretColor: c('accent') },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: c('accent') },
  '.cm-gutters': { backgroundColor: 'transparent', color: c('muted', 0.55), border: 'none' },
  '.cm-activeLine': { backgroundColor: c('text', 0.04) },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: c('text', 0.85) },
  '&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection':
    { backgroundColor: c('accent', 0.28) },
  '.cm-selectionMatch': { backgroundColor: c('accent', 0.15) },
  '&.cm-focused .cm-matchingBracket': { backgroundColor: c('accent', 0.25), outline: 'none' },
  '.cm-foldPlaceholder': { backgroundColor: c('surface'), border: `1px solid ${c('border')}`, color: c('muted') },
  '.cm-placeholder': { color: c('muted', 0.6) },
  '.cm-tooltip': { backgroundColor: c('panel'), border: `1px solid ${c('border')}`, color: c('text') },
  '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: c('accent', 0.3), color: c('text') },
  '.cm-panels': { backgroundColor: c('panel'), color: c('text') },
  '.cm-panels.cm-panels-bottom': { borderTop: `1px solid ${c('border')}` },
  '.cm-panels.cm-panels-top': { borderBottom: `1px solid ${c('border')}` },
  '.cm-textfield': {
    backgroundColor: c('surface'),
    border: `1px solid ${c('border')}`,
    color: c('text'),
    borderRadius: '4px'
  },
  '.cm-button': {
    backgroundImage: 'none',
    backgroundColor: c('surface'),
    border: `1px solid ${c('border')}`,
    color: c('text'),
    borderRadius: '4px'
  },
  '.cm-sar-var, .cm-sar-var *': { color: `${c('success')} !important` },
  '.cm-sar-var': { backgroundColor: c('success', 0.13), borderRadius: '3px' },
  '.cm-sar-var-missing, .cm-sar-var-missing *': { color: `${c('danger')} !important` },
  '.cm-sar-var-missing': { backgroundColor: c('danger', 0.13) },
  '.cm-sar-var-tip': { padding: '4px 8px', fontFamily: 'var(--sar-font-mono)', fontSize: '12px' },
  '.cm-sar-var-tip .src': { color: c('muted'), marginLeft: '8px' },
  '.cm-searchMatch': { backgroundColor: c('warning', 0.25) },
  '.cm-searchMatch.cm-searchMatch-selected': { backgroundColor: c('warning', 0.5) }
})

const sarHighlight = HighlightStyle.define([
  { tag: [t.propertyName, t.attributeName], color: c('code-key') },
  { tag: [t.string, t.special(t.string), t.attributeValue], color: c('code-string') },
  { tag: t.number, color: c('code-number') },
  { tag: [t.bool, t.keyword], color: c('code-bool') },
  { tag: t.null, color: c('code-null'), fontStyle: 'italic' },
  { tag: [t.punctuation, t.bracket, t.separator, t.angleBracket], color: c('code-punct') },
  { tag: t.tagName, color: c('code-key') },
  { tag: t.comment, color: c('muted'), fontStyle: 'italic' },
  { tag: t.invalid, color: c('danger') }
])

const readonlyExt = (ro) => [EditorState.readOnly.of(ro)]

// Rebuilt whenever the set of defined variable names changes, so colors stay correct.
function variablesExt() {
  if (!props.variables) return []

  const decorator = new MatchDecorator({
    regexp: varRegex(),
    decoration: (m) => Decoration.mark({ class: env.isDefined(m[1]) ? 'cm-sar-var' : 'cm-sar-var cm-sar-var-missing' })
  })
  const highlight = ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = decorator.createDeco(view)
      }
      update(update) {
        this.decorations = decorator.updateDeco(update, this.decorations)
      }
    },
    { decorations: (v) => v.decorations }
  )

  const tooltip = hoverTooltip((view, pos) => {
    const line = view.state.doc.lineAt(pos)
    for (const m of line.text.matchAll(varRegex())) {
      const from = line.from + m.index
      const to = from + m[0].length
      if (pos < from || pos > to) continue
      return {
        pos: from,
        end: to,
        above: true,
        create() {
          const dom = document.createElement('div')
          dom.className = 'cm-sar-var-tip'
          const info = env.describe(m[1])
          dom.textContent = info ? `${info.secret ? '••••••' : info.value}` : `"${m[1]}" is not defined`
          if (info) {
            const src = document.createElement('span')
            src.className = 'src'
            src.textContent = info.source
            dom.append(src)
          }
          return { dom }
        }
      }
    }
    return null
  })

  const completion = EditorState.languageData.of(() => [
    {
      autocomplete(context) {
        const match = context.matchBefore(/\{\{[\w.$-]*/)
        if (!match) return null
        return {
          from: match.from + 2,
          validFor: /^[\w.$-]*$/,
          options: env.suggestions().map((s) => ({
            label: s.name,
            detail: s.secret ? '••••••' : s.value,
            type: 'variable',
            apply(view, completion, from, to) {
              const close = view.state.sliceDoc(to, to + 2) === '}}' ? '' : '}}'
              view.dispatch({
                changes: { from, to, insert: completion.label + close },
                selection: { anchor: from + completion.label.length + 2 }
              })
            }
          }))
        }
      }
    }
  ])

  return [highlight, tooltip, completion]
}

watch(
  () => env.names.join('\n'),
  () => view?.dispatch({ effects: variablesConf.reconfigure(variablesExt()) })
)

onMounted(() => {
  view = new EditorView({
    parent: host.value,
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        basicSetup,
        keymap.of([indentWithTab]),
        wrapConf.of(wrapExt(props.wrap)),
        sarTheme,
        syntaxHighlighting(sarHighlight),
        props.placeholder ? cmPlaceholder(props.placeholder) : [],
        languageConf.of(languageExt(props.language)),
        readonlyConf.of(readonlyExt(props.readonly)),
        variablesConf.of(variablesExt()),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) emit('update:modelValue', update.state.doc.toString())
        })
      ]
    })
  })
})

onBeforeUnmount(() => view?.destroy())

watch(
  () => props.modelValue,
  (value) => {
    if (!view) return
    const current = view.state.doc.toString()
    if (value !== current) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } })
    }
  }
)

watch(
  () => props.language,
  (lang) => view?.dispatch({ effects: languageConf.reconfigure(languageExt(lang)) })
)

watch(
  () => props.wrap,
  (on) => view?.dispatch({ effects: wrapConf.reconfigure(wrapExt(on)) })
)

watch(
  () => props.readonly,
  (ro) => view?.dispatch({ effects: readonlyConf.reconfigure(readonlyExt(ro)) })
)

defineExpose({
  focus: () => view?.focus(),
  find: () => view && openSearchPanel(view)
})
</script>

<template>
  <div ref="host" class="h-full min-h-0 overflow-hidden"></div>
</template>
