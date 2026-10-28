import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
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

  mount(
    parent: HTMLElement,
    initialDoc: string,
    onChange: ChangeHandler,
    readOnly: boolean,
  ): void {
    const extensions = [
      lineNumbers(),
      highlightActiveLine(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      cpp(),
      oneDark,
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
      EditorView.editable.of(!readOnly),
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
      effects: EditorState.readOnly.of(readOnly),
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