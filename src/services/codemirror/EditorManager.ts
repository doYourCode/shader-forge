import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
} from '@codemirror/view';
import { Compartment, EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { glsl } from 'codemirror-lang-glsl';
import { oneDark } from '@codemirror/theme-one-dark';
import {
  diagnosticsExtensions,
  injectedBlockExtensions,
  setDiagnosticsEffect,
  setInjectedBlockEffect,
  type EditorDiagnostic,
} from './editorExtensions';
import { shaderSyntaxHighlighting } from './syntaxTheme';

export type { EditorDiagnostic } from './editorExtensions';

export interface CursorPos {
  line: number;
  col: number;
}

export type ChangeHandler = (pos: CursorPos) => void;

/**
 * Owns one CodeMirror view and the operations the editor screen needs: expose
 * and replace the buffer, toggle read-only, publish diagnostics and the
 * generated user-data preview, reveal a position and dispose the view.
 *
 * The extensions that render diagnostics and the injected block live in
 * `editorExtensions.ts`; this class only composes them with the view.
 */
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
      glsl(),
      oneDark,
      shaderSyntaxHighlighting,
      ...diagnosticsExtensions,
      ...injectedBlockExtensions,
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

  /**
   * Shows the generated user-data block as a read-only preview above the source
   * (pass null to clear it). The lines never enter the document, so the editor
   * value and every diagnostic line mapping stay exactly as they were.
   */
  setInjectedBlock(lines: readonly string[] | null): void {
    if (!this.view) return;
    this.view.dispatch({
      effects: setInjectedBlockEffect.of(lines),
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
