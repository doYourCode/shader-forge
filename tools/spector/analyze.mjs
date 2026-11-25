#!/usr/bin/env node
/**
 * Turn the Spector captures under `tools/spector/out/` into a markdown report.
 *
 *   node tools/spector/analyze.mjs
 *
 * Reads only the stored JSON, so it can be re-run without a browser.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const OUT_DIR = process.argv[2] ?? 'tools/spector/out';

// gl.drawBuffers also starts with "draw" but only sets MRT state.
const DRAW_COMMANDS =
  /^(drawArrays|drawElements|drawArraysInstanced|drawElementsInstanced|drawRangeElements|multiDraw\w*)$/;

const files = (await readdir(OUT_DIR))
  .filter((name) => name.endsWith('.json') && name !== 'index.json')
  .sort();

if (!files.length) {
  console.error(`no captures in ${OUT_DIR}`);
  process.exit(1);
}

const captures = [];
for (const file of files) {
  const record = JSON.parse(await readFile(join(OUT_DIR, file), 'utf8'));
  // `control.json` holds the no-Spector baseline and has no capture.
  if (record.capture) captures.push({ file, ...record });
}

if (!captures.length) {
  console.error('no Spector captures in ' + OUT_DIR);
  process.exit(1);
}

const lines = [];
lines.push('# Spector capture summary');
lines.push('');
lines.push(`Generated from ${captures.length} capture(s) in \`${OUT_DIR}\`.`);
lines.push('');

lines.push('## Frame totals');
lines.push('');
lines.push(
  '| scenario | commands | draws | drawBuffers | FB binds | instances | programs | textures |' +
    ' redundant | glErrors |',
);
lines.push(
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
);
for (const { scenario, capture } of captures) {
  const stats = commandStats(capture);
  lines.push(
    `| ${scenario.id} | ${capture.commandCount} | ${stats.draws} | ` +
      `${stats.drawBuffers} | ${stats.bindFramebuffer} | ${capture.draws.instances} | ` +
      `${capture.uniqueObjects.programs} | ${capture.uniqueObjects.textures} | ` +
      `${capture.redundant.total} | ${capture.glErrors.length} |`,
  );
}
lines.push('');

lines.push('## Pass split (approximate, from the command stream)');
lines.push('');
lines.push(
  '| scenario | shadow draws | scene draws | fullscreen draws | viewports | triangles |',
);
lines.push('| --- | --- | --- | --- | --- | --- |');
for (const { scenario, capture } of captures) {
  const split = splitPasses(capture);
  lines.push(
    `| ${scenario.id} | ${split.shadow} | ${split.scene} | ${split.fullscreen} | ` +
      `${split.viewports.join(', ') || '-'} | ${triangleCount(capture)} |`,
  );
}
lines.push('');
lines.push(
  'Draws exclude gl.drawBuffers (MRT state), which also starts with "draw".',
);
lines.push('');

lines.push('## Uploads per frame');
lines.push('');
lines.push(
  '| scenario | texImage2D | texSubImage2D | bufferData | bufferSubData |',
);
lines.push('| --- | --- | --- | --- | --- |');
for (const { scenario, capture } of captures) {
  const u = capture.uploads;
  lines.push(
    `| ${scenario.id} | ${u.texImage2D} | ${u.texSubImage2D} | ${u.bufferData} | ${u.bufferSubData} |`,
  );
}
lines.push('');

lines.push('## Overlay vs capture (draw calls)');
lines.push('');
lines.push(
  '| scenario | overlay before | overlay after | Spector draws/frame |',
);
lines.push('| --- | --- | --- | --- |');
for (const { scenario, capture, page } of captures) {
  lines.push(
    `| ${scenario.id} | ${page.statsBefore ?? '-'} | ${page.statsAfter ?? '-'} | ` +
      `${capture.draws.calls} |`,
  );
}
lines.push('');

lines.push('## Stability signals');
lines.push('');
for (const { scenario, capture, page, console: log } of captures) {
  const shaderFailures = [
    ...capture.shaders.filter((s) => s.compiled === false),
    ...capture.programs.filter((p) => p.linked === false),
  ];
  lines.push(`### ${scenario.id}`);
  lines.push('');
  lines.push(
    `- UI errors: ${page.uiErrors.length ? page.uiErrors.join(' / ') : 'none'}`,
  );
  lines.push(`- WebGL faults in console: ${log.webGlFaultCount}`);
  for (const fault of log.webGlFaults)
    lines.push(`  - ${fault.count} x ${fault.text}`);
  lines.push(
    `- Shader/program failures in frame: ${shaderFailures.length}` +
      (shaderFailures.length
        ? ` (${shaderFailures.map((s) => s.infoLog || 'no log').join('; ')})`
        : ''),
  );
  lines.push(`- getError results: ${capture.glErrors.join(', ') || 'none'}`);
  lines.push(
    `- Spector errors: ${capture.meta.spectorErrors.join('; ') || 'none'}`,
  );
  lines.push('');
}

lines.push('## Redundant GL calls');
lines.push('');
for (const { scenario, capture } of captures) {
  const commands = capture.redundant.byCommand
    .map(([name, count]) => `${name} x${count}`)
    .join(', ');
  lines.push(`- **${scenario.id}**: ${commands || 'none'}`);
  for (const [origin, count] of capture.redundant.byOrigin.slice(0, 3)) {
    lines.push(`  - ${count} x ${origin}`);
  }
}
lines.push('');

const markdown = `${lines.join('\n')}\n`;
await writeFile(join(OUT_DIR, 'summary.md'), markdown);
process.stdout.write(markdown);

function commandStats(capture) {
  const commands = capture.commands ?? [];
  let draws = 0;
  let drawBuffers = 0;
  let bindFramebuffer = 0;
  const programs = new Set();
  const textures = new Set();
  for (const command of commands) {
    if (DRAW_COMMANDS.test(command.n)) draws += 1;
    if (command.n === 'drawBuffers') drawBuffers += 1;
    if (command.n === 'bindFramebuffer') bindFramebuffer += 1;
    const id = /ID: (\d+)/.exec(command.t);
    if (id && command.n === 'useProgram') programs.add(id[1]);
    if (id && command.n === 'bindTexture') textures.add(id[1]);
  }
  return {
    draws,
    drawBuffers,
    bindFramebuffer,
    programs: programs.size,
    textures: textures.size,
  };
}

function splitPasses(capture) {
  const commands = capture.commands ?? [];
  const canvasWidth = capture.canvas?.width ?? 0;
  const viewports = new Set();
  let shadow = 0;
  let scene = 0;
  let fullscreen = 0;
  let segmentDraws = 0;
  let segmentViewport = null;

  const flush = () => {
    if (!segmentDraws) return;
    const width = segmentViewport?.width ?? 0;
    const height = segmentViewport?.height ?? 0;
    const shadowLike =
      width > 0 && width === height && width >= 1024 && width !== canvasWidth;
    if (shadowLike) shadow += segmentDraws;
    else if (segmentDraws === 1) fullscreen += segmentDraws;
    else scene += segmentDraws;
    segmentDraws = 0;
  };

  for (const command of commands) {
    if (command.n === 'bindFramebuffer') {
      // The viewport is GL state: it survives a framebuffer bind until it is
      // set again, and the shadow passes set it before binding their target.
      flush();
      continue;
    }
    if (command.n === 'viewport') {
      const numbers = command.t.match(/\d+/g);
      if (numbers && numbers.length >= 4) {
        segmentViewport = {
          width: Number(numbers[2]),
          height: Number(numbers[3]),
        };
        viewports.add(`${segmentViewport.width}x${segmentViewport.height}`);
      }
      continue;
    }
    if (DRAW_COMMANDS.test(command.n)) segmentDraws += 1;
  }
  flush();

  const ordered = [...viewports].sort(
    (a, b) => Number(b.split('x')[0]) - Number(a.split('x')[0]),
  );
  return { shadow, scene, fullscreen, viewports: ordered };
}

function triangleCount(capture) {
  const primitives = capture.analyses?.find((a) => a.name === 'Primitives');
  if (!primitives || primitives.triangles == null) return '-';
  return Math.round(primitives.triangles).toLocaleString('en-US');
}
