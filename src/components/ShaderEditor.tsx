
import { useEffect, useRef } from 'react'
import { basicSetup } from 'codemirror'
import { EditorView } from '@codemirror/view'
import { glsl } from 'codemirror-lang-glsl'

interface ShaderEditorProps {
  value: string
  onChange: (value: string) => void
}

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
        glsl(),
        shaderTheme,
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

  return (
    <div
      ref={containerRef}
      className="shader-editor-mount"
      aria-label="GLSL code editor"
    />
  )
}
