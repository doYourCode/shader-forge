import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';

/**
 * Project syntax palette, layered after `oneDark` so hue carries meaning.
 *
 * Keywords, types, functions and literals each get one hue, identifiers stay
 * neutral (oneDark paints them red, which reads as an error in an editor) and
 * comments recede. Colours resolve from `--syntax-*` tokens in `style.css` so
 * the palette is declared in one place.
 */
const shaderHighlightStyle = HighlightStyle.define([
  {
    tag: [
      tags.keyword,
      tags.controlKeyword,
      tags.definitionKeyword,
      tags.moduleKeyword,
      tags.modifier,
    ],
    color: 'var(--syntax-keyword)',
  },
  {
    tag: [
      tags.typeName,
      tags.className,
      tags.namespace,
      tags.standard(tags.typeName),
      tags.standard(tags.name),
    ],
    color: 'var(--syntax-type)',
  },
  {
    tag: [
      tags.function(tags.variableName),
      tags.function(tags.propertyName),
      tags.macroName,
    ],
    color: 'var(--syntax-function)',
  },
  {
    tag: [tags.number, tags.bool, tags.string, tags.atom],
    color: 'var(--syntax-literal)',
  },
  {
    tag: [tags.variableName, tags.attributeName, tags.labelName],
    color: 'var(--syntax-variable)',
  },
  {
    tag: [tags.propertyName, tags.definition(tags.variableName)],
    color: 'var(--syntax-property)',
  },
  {
    tag: tags.comment,
    color: 'var(--syntax-comment)',
    fontStyle: 'italic',
  },
  {
    tag: [tags.operator, tags.punctuation, tags.separator],
    color: 'var(--syntax-operator)',
  },
  {
    tag: [tags.invalid, tags.deleted],
    color: 'var(--syntax-error)',
  },
]);

/** Must be added after `oneDark` so these tags win over its defaults. */
export const shaderSyntaxHighlighting =
  syntaxHighlighting(shaderHighlightStyle);
