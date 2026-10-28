import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  Decoration,
  type DecorationSet,
} from '@codemirror/view';
import {
  Compartment,
  EditorState,
  StateEffect,
  StateField,
} from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { cpp } from '@codemirror/lang-cpp';
import { oneDark } from '@codemirror/theme-one-dark';

export interface CursorPos {
  line: number;
  col: number;
}

export type ChangeHandler = (pos: CursorPos) => void;

const setErrorLinesEffect = StateEffect.define<readonly number[]>();

const errorLineDecoration = Decoration.line({
  class: 'cm-shader-error-line',
});

const errorLinesField = StateField.define<DecorationSet>({
  create: () => Decoration.none,

  update(decorations, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setErrorLinesEffect)) {
        const doc = transaction.state.doc;
        const lines = [...new Set(effect.value)]
          .filter((line) => Number.isInteger(line) && line >= 1 && line <= doc.lines)
          .sort((a, b) => a - b);

        return Decoration.set(
          lines.map((line) => errorLineDecoration.range(doc.line(line).from)),
          true,
        );
      }
    }

    return decorations.map(transaction.changes);
  },

  provide: (field) => EditorView.decorations.from(field),
});

const errorHighlightTheme = EditorView.theme({
  '.cm-line.cm-shader-error-line': {
    backgroundColor: 'rgba(224, 108, 117, 0.22)',
    boxShadow: 'inset 3px 0 0 #e06c75',
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
      errorLinesField,
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

  setErrorLines(lines: readonly number[]): void {
    if (!this.view) return;
    this.view.dispatch({
      effects: setErrorLinesEffect.of(lines),
    });
  }

  revealLine(line: number): void {
    if (!this.view) return;
    const target = Math.min(Math.max(1, line), this.view.state.doc.lines);
    const lineInfo = this.view.state.doc.line(target);

    this.view.dispatch({
      selection: { anchor: lineInfo.from },
      effects: EditorView.scrollIntoView(lineInfo.from, { y: 'center' }),
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
