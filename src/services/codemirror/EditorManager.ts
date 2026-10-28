import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { Compartment, EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { cpp } from '@codemirror/lang-cpp';
import { oneDark } from '@codemirror/theme-one-dark';

export interface CursorPos {
  line: number;
  col: number;
}

export type ChangeHandler = (pos: CursorPos) => void;

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

  focus(): void {
    this.view?.focus();
  }

  dispose(): void {
    this.view?.destroy();
    this.view = null;
  }
}