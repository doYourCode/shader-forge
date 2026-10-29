import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  Decoration,
  GutterMarker,
  lineNumberMarkers,
  type DecorationSet,
} from '@codemirror/view';
import {
  Compartment,
  EditorState,
  RangeSet,
  StateEffect,
  StateField,
  type Range,
  type Text,
} from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { cpp } from '@codemirror/lang-cpp';
import { oneDark } from '@codemirror/theme-one-dark';

export interface CursorPos {
  line: number;
  col: number;
}

export interface EditorDiagnostic {
  /** 1-based editor line. */
  line: number;
  /** 1-based column reported by the driver, when available. */
  column: number | null;
  /** Text shown when hovering the squiggle. */
  message: string;
}

export type ChangeHandler = (pos: CursorPos) => void;

const setDiagnosticsEffect = StateEffect.define<readonly EditorDiagnostic[]>();

const errorLineDecoration = Decoration.line({
  class: 'cm-shader-error-line',
});

class ShaderErrorMarker extends GutterMarker {
  toDOM(): Node {
    const marker = document.createElement('span');
    marker.className = 'cm-shader-error-gutter';
    marker.textContent = '●';
    marker.title = 'Shader error on this line';
    return marker;
  }
}

const shaderErrorMarker = new ShaderErrorMarker();

const diagnosticsField = StateField.define<DecorationSet>({
  create: () => Decoration.none,

  update(decorations, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setDiagnosticsEffect)) {
        return createDecorations(transaction.state.doc, effect.value);
      }
    }

    return decorations.map(transaction.changes);
  },

  provide: (field) => EditorView.decorations.from(field),
});

const diagnosticsMarkersField = StateField.define<RangeSet<GutterMarker>>({
  create: () => RangeSet.empty,

  update(markers, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setDiagnosticsEffect)) {
        return createMarkers(transaction.state.doc, effect.value);
      }
    }

    return markers.map(transaction.changes);
  },

  provide: (field) => lineNumberMarkers.from(field),
});

const errorHighlightTheme = EditorView.theme({
  '.cm-line.cm-shader-error-line': {
    backgroundColor: 'rgba(224, 108, 117, 0.14)',
    boxShadow: 'inset 3px 0 0 #e06c75',
  },
  '.cm-shader-error-token': {
    textDecoration: 'underline wavy #e06c75',
    textUnderlineOffset: '2px',
    textDecorationSkipInk: 'none',
    backgroundColor: 'rgba(224, 108, 117, 0.16)',
    borderRadius: '2px',
    cursor: 'help',
  },
  '.cm-shader-error-gutter': {
    color: '#e06c75',
    marginLeft: '2px',
    fontSize: '9px',
    lineHeight: '1',
  },
});

export class EditorManager {
  private view: EditorView | null = null;
  private readonlyCompartment = new Compartment();

  mount(
    parent: HTMLElement,
    initialDoc: string,
    onChange: ChangeHandler,
    readOnly: boolean,
  ): void {
    this.dispose();

    const extensions = [
      lineNumbers(),
      highlightActiveLine(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      cpp(),
      oneDark,
      diagnosticsField,
      diagnosticsMarkersField,
      errorHighlightTheme,
      this.readonlyCompartment.of([
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged || update.selectionSet) {
          const head = update.state.selection.main.head;
          const line = update.state.doc.lineAt(head);
          onChange({
            line: line.number,
            col: head - line.from + 1,
          });
        }
      }),
    ];

    this.view = new EditorView({
      state: EditorState.create({
        doc: initialDoc,
        extensions,
      }),
      parent,
    });
  }

  getValue(): string {
    return this.view?.state.doc.toString() ?? '';
  }

  setValue(value: string): void {
    if (!this.view) return;
    this.view.dispatch({
      changes: {
        from: 0,
        to: this.view.state.doc.length,
        insert: value,
      },
    });
  }

  setReadOnly(readOnly: boolean): void {
    if (!this.view) return;
    this.view.dispatch({
      effects: this.readonlyCompartment.reconfigure([
        EditorState.readOnly.of(readOnly),
        EditorView.editable.of(!readOnly),
      ]),
    });
  }

  setDiagnostics(diagnostics: readonly EditorDiagnostic[]): void {
    if (!this.view) return;
    this.view.dispatch({
      effects: setDiagnosticsEffect.of(diagnostics),
    });
  }

  revealPosition(line: number, column: number | null = null): void {
    if (!this.view) return;
    const target = Math.min(Math.max(1, line), this.view.state.doc.lines);
    const lineInfo = this.view.state.doc.line(target);
    const offset =
      column === null ? 0 : Math.max(0, Math.min(column - 1, lineInfo.length));
    const anchor = lineInfo.from + offset;

    this.view.dispatch({
      selection: { anchor },
      effects: EditorView.scrollIntoView(anchor, { y: 'center' }),
    });
    this.view.focus();
  }

  focus(): void {
    this.view?.focus();
  }

  dispose(): void {
    this.view?.destroy();
    this.view = null;
  }
}

function createDecorations(
  doc: Text,
  diagnostics: readonly EditorDiagnostic[],
): DecorationSet {
  const ranges: Range<Decoration>[] = [];
  const outlinedLines = new Set<number>();

  for (const diagnostic of diagnostics) {
    if (!isValidLine(diagnostic.line, doc.lines)) continue;

    const line = doc.line(diagnostic.line);
    if (!outlinedLines.has(diagnostic.line)) {
      ranges.push(errorLineDecoration.range(line.from));
      outlinedLines.add(diagnostic.line);
    }

    const token = errorTokenRange(doc, diagnostic);
    if (token) {
      ranges.push(
        Decoration.mark({
          class: 'cm-shader-error-token',
          attributes: { title: diagnostic.message },
        }).range(token.from, token.to),
      );
    }
  }

  return Decoration.set(ranges, true);
}

function createMarkers(
  doc: Text,
  diagnostics: readonly EditorDiagnostic[],
): RangeSet<GutterMarker> {
  const seen = new Set<number>();
  const ranges: Range<GutterMarker>[] = [];

  for (const diagnostic of diagnostics) {
    if (!isValidLine(diagnostic.line, doc.lines) || seen.has(diagnostic.line)) {
      continue;
    }

    seen.add(diagnostic.line);
    ranges.push(shaderErrorMarker.range(doc.line(diagnostic.line).from));
  }

  return RangeSet.of(ranges, true);
}

function isValidLine(line: number, lineCount: number): boolean {
  return Number.isInteger(line) && line >= 1 && line <= lineCount;
}

function errorTokenRange(
  doc: Text,
  diagnostic: EditorDiagnostic,
): { from: number; to: number } | null {
  const line = doc.line(diagnostic.line);
  const text = line.text;
  if (text.length === 0) return null;

  let start =
    diagnostic.column !== null && diagnostic.column > 0
      ? Math.min(diagnostic.column - 1, text.length - 1)
      : text.search(/\S/);

  if (start < 0) return null;

  if (/\s/.test(text[start])) {
    const next = text.slice(start).search(/\S/);
    if (next < 0) return null;
    start += next;
  }

  let end = start + 1;
  if (/[\w$]/.test(text[start])) {
    while (end < text.length && /[\w$]/.test(text[end])) end++;
  }

  return { from: line.from + start, to: line.from + end };
}
