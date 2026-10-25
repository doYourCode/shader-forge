
import { useEffect, useRef } from 'react'
import { basicSetup } from 'codemirror'
import { EditorView, keymap } from '@codemirror/view'
import { glsl } from 'codemirror-lang-glsl'
import { StateField, StateEffect } from '@codemirror/state'
import { Decoration, type DecorationSet } from '@codemirror/view'
import {indentWithTab} from "@codemirror/commands"

interface ShaderEditorProps {
  value: string
  onChange: (value: string) => void
  errorLines: number[]
}

const setErrorLines = StateEffect.define<number[]>()

const errorLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,

update(decorations, transaction) {
  decorations = decorations.map(transaction.changes)

  for (const effect of transaction.effects) {
    if (effect.is(setErrorLines)) {
      const lines = [...new Set(effect.value)]
        .filter(
          (line) =>
            Number.isInteger(line) &&
            line >= 1 &&
            line <= transaction.state.doc.lines,
        )
        .sort((a, b) => a - b)

      decorations = Decoration.set(
        lines.map((line) =>
          Decoration.line({
            class: 'cm-shader-error-line',
          }).range(transaction.state.doc.line(line).from),
        ),
        true,
      )
    }
  }

  return decorations
},

  provide: (field) =>
    EditorView.decorations.from(field),
})

const shaderTheme = EditorView.theme(
  {
    '&': {
      height: '100%',
      backgroundColor: '#15171d',
      color: '#b7d9ff',
      fontSize: '13px',
    },
    '.cm-scroller': {
      overflow: 'auto',
      fontFamily: 'monospace',
      lineHeight: '1.7',
    },
    '.cm-content': {
      padding: '14px 0',
      caretColor: '#a9adff',
    },
    '.cm-line': {
      padding: '0 14px 0 4px',
    },
    '.cm-gutters': {
      backgroundColor: '#15171d',
      color: '#626b7a',
      border: 'none',
    },
        '.cm-shader-error-line': {
      backgroundColor: '#ff333322',
      borderLeft: '3px solid #ff5c5c',
    },
    '.cm-activeLine': {
      backgroundColor: '#ffffff08',
    },
    '.cm-activeLineGutter': {
      backgroundColor: '#ffffff08',
      color: '#c4cbd5',
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '.cm-cursor': {
      borderLeftColor: '#a9adff',
    },
    '&.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: '#555bb5 !important',
    },
  },
  { dark: true },
)

export default function ShaderEditor({
  value,
  onChange,
  errorLines,
}: ShaderEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // Create the editor once and clean it up when unmounted.
  useEffect(() => {
    const parent = containerRef.current

    if (!parent) return

    const view = new EditorView({
      doc: value,
      parent,
      extensions: [
        basicSetup,
        keymap.of([indentWithTab]),
        glsl(),
        shaderTheme,
        errorLineField,
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString())
          }
        }),
      ],
    })

    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // The editor is created once; onChange is expected to be stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the editor synchronized with external changes, such as Reset.
  useEffect(() => {
    const view = viewRef.current

    if (!view) return

    const currentValue = view.state.doc.toString()

    if (currentValue !== value) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: value,
        },
      })
    }
  }, [value])

  useEffect(() => {
  const view = viewRef.current

  if (!view) return

  view.dispatch({
    effects: setErrorLines.of(errorLines),
  })
}, [errorLines])

  return (
    <div
      ref={containerRef}
      className="shader-editor-mount"
      aria-label="GLSL code editor"
    />
  )
}
