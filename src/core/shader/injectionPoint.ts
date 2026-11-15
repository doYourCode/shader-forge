/**
 * Where the generated user-data block belongs inside a stage source.
 *
 * The compiler injects the block and the editor previews it read-only, so the
 * placement rule lives here instead of in either caller: the preview has to sit
 * exactly where the declarations end up.
 */

/** A line the block may be inserted after: blanks, comments, directives. */
export function isShaderHeaderLine(line: string): boolean {
  const text = line.trim();

  return text === '' || text.startsWith('//') || isShaderHeaderDirective(text);
}

/** `#version`, `precision` and `#extension` must precede any declaration. */
export function isShaderHeaderDirective(line: string): boolean {
  const text = line.trim();

  return (
    /^#version\b/i.test(text) ||
    /^precision\b/i.test(text) ||
    /^#extension\b/i.test(text)
  );
}

/**
 * 0-based index of the first line after the header run, which is also the line
 * the block is inserted before. Equal to the line count when the source is
 * nothing but a header.
 */
export function findInjectionLine(lines: readonly string[]): number {
  let insertion = 0;

  for (let index = 0; index < lines.length; index++) {
    const text = lines[index]!;

    if (!isShaderHeaderLine(text)) break;
    if (isShaderHeaderDirective(text)) insertion = index + 1;
  }

  return insertion;
}
