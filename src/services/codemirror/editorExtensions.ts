import {
  Decoration,
  EditorView,
  GutterMarker,
  WidgetType,
  lineNumberMarkers,
  type DecorationSet,
} from '@codemirror/view';
import {
  RangeSet,
  StateEffect,
  StateField,
  type Extension,
  type Range,
  type Text,
} from '@codemirror/state';
import {
  isShaderHeaderDirective,
  isShaderHeaderLine,
} from '@/core/shader/injectionPoint';

/**
 * One compiler diagnostic as the editor renders it. Declared beside the
 * extensions that consume it; `EditorManager` re-exports it as part of its
 * public API.
 */
export interface EditorDiagnostic {
  /** 1-based editor line. */
  line: number;
  /** 1-based column reported by the driver, when available. */
  column: number | null;
  /** Text shown when hovering the squiggle. */
  message: string;
}

/** Applies a fresh diagnostic set; consumed by both diagnostic fields. */
export const setDiagnosticsEffect =
  StateEffect.define<readonly EditorDiagnostic[]>();

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

/** Diagnostic decorations, line markers and their shared theme. */
export const diagnosticsExtensions: readonly Extension[] = [
  diagnosticsField,
  diagnosticsMarkersField,
  errorHighlightTheme,
];

export const setInjectedBlockEffect = StateEffect.define<
  readonly string[] | null
>();

/**
 * Read-only preview of the generated user-data block.
 *
 * It is a widget rather than document text: the compiler injects its own copy,
 * so a copy in the buffer would declare everything twice — and keeping the
 * buffer byte-for-byte what the user wrote is what the line mapping and
 * `getValue()` rely on. Being outside the document also makes it non-editable
 * by construction, with no transaction filtering.
 */
class InjectedBlockWidget extends WidgetType {
  private readonly lines: readonly string[];

  constructor(lines: readonly string[]) {
    super();
    this.lines = lines;
  }

  eq(other: WidgetType): boolean {
    return (
      other instanceof InjectedBlockWidget &&
      other.lines.length === this.lines.length &&
      other.lines.every((line, index) => line === this.lines[index])
    );
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'cm-injected-block';
    wrapper.setAttribute('role', 'group');
    wrapper.setAttribute(
      'aria-label',
      'Generated user data uniforms, read only',
    );

    const badge = document.createElement('div');
    badge.className = 'cm-injected-block__badge';
    badge.textContent = 'read-only · user data';

    const code = document.createElement('pre');
    code.className = 'cm-injected-block__code';
    code.textContent = this.lines.join('\n');

    wrapper.append(badge, code);
    return wrapper;
  }

  /** Clicks and drags inside the preview never reach the editor. */
  ignoreEvent(): boolean {
    return true;
  }
}

interface InjectedBlockState {
  readonly lines: readonly string[] | null;
  readonly decorations: DecorationSet;
}

const injectedBlockField = StateField.define<InjectedBlockState>({
  create: () => ({ lines: null, decorations: Decoration.none }),

  update(current, transaction) {
    let lines = current.lines;

    for (const effect of transaction.effects) {
      if (effect.is(setInjectedBlockEffect)) lines = effect.value;
    }

    const next = lines && lines.length > 0 ? lines : null;

    if (next === current.lines && !transaction.docChanged) {
      return {
        lines: current.lines,
        decorations: current.decorations.map(transaction.changes),
      };
    }

    // The block content may be unchanged while the document moved its anchor
    // (the header run can be edited), so a doc change always re-anchors.
    return {
      lines: next,
      decorations: injectedBlockDecorations(transaction.state.doc, next),
    };
  },

  provide: (field) =>
    EditorView.decorations.from(field, (value) => value.decorations),
});

function injectedBlockDecorations(
  doc: Text,
  lines: readonly string[] | null,
): DecorationSet {
  if (!lines || lines.length === 0) return Decoration.none;

  return Decoration.set([
    Decoration.widget({
      widget: new InjectedBlockWidget(lines),
      block: true,
      side: 1,
    }).range(injectionOffset(doc)),
  ]);
}

/** Character offset the preview is inserted at, per the shared codegen rule. */
function injectionOffset(doc: Text): number {
  let insertionLine = 0;

  for (let lineNumber = 1; lineNumber <= doc.lines; lineNumber++) {
    const text = doc.line(lineNumber).text;

    if (!isShaderHeaderLine(text)) break;
    if (isShaderHeaderDirective(text)) insertionLine = lineNumber;
  }

  return insertionLine >= doc.lines
    ? doc.length
    : doc.line(insertionLine + 1).from;
}

const injectedBlockTheme = EditorView.theme({
  '.cm-injected-block': {
    margin: '4px 0 8px',
    background: 'rgba(152, 195, 121, 0.08)',
    border: '1px solid rgba(152, 195, 121, 0.35)',
    borderLeft: '3px solid var(--accent-ui)',
    borderRadius: '3px',
    // The preview is not part of the document: clicks fall through to the
    // editor (so the caret lands next to it, not inside it) and its text can
    // never be selected.
    pointerEvents: 'none',
    userSelect: 'none',
  },
  '.cm-injected-block__badge': {
    padding: '3px 8px 0',
    color: 'var(--syntax-function)',
    fontFamily: 'var(--font-ui)',
    fontSize: 'var(--font-size-label)',
    fontWeight: '700',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    userSelect: 'none',
  },
  '.cm-injected-block__code': {
    margin: '0',
    padding: '2px 8px 6px',
    color: 'var(--fg-muted)',
    fontFamily: 'var(--font-code)',
    fontSize: '12px',
    lineHeight: '1.5',
    // Wrapped instead of scrolled: the block cannot receive pointer events to
    // drag a scrollbar. Long value comments wrap rather than disappear.
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
});

/** The generated user-data preview state field and its theme. */
export const injectedBlockExtensions: readonly Extension[] = [
  injectedBlockField,
  injectedBlockTheme,
];

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
