#!/usr/bin/env node
/**
 * Regenerates `content/en/docs/abi-reference.md` from the ABI declarations.
 *
 * Node 24 strips TypeScript types natively, so this runs the pure ABI modules
 * directly; the builder deliberately uses relative `.ts` imports and imports no
 * shader assets. Run with `--check` to verify the committed page without
 * writing it (the test suite uses the same comparison in-process).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  ABI_REFERENCE_PATH,
  buildAbiReferenceMarkdown,
} from '../src/core/content/abiReference.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, ABI_REFERENCE_PATH);
const markdown = buildAbiReferenceMarkdown();
const check = process.argv.includes('--check');

const out = (message) => process.stdout.write(`${message}\n`);
const fail = (message) => process.stderr.write(`${message}\n`);

if (check) {
  const current = await readFile(target, 'utf8').catch(() => '');
  if (current !== markdown) {
    fail(
      `${ABI_REFERENCE_PATH} is out of date. Run \`npm run docs:abi\` and commit the result.`,
    );
    process.exitCode = 1;
  } else {
    out(`${ABI_REFERENCE_PATH} is up to date.`);
  }
} else {
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, markdown, 'utf8');
  out(`Wrote ${ABI_REFERENCE_PATH}.`);
}
