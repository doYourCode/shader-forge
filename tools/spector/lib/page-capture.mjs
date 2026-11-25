/**
 * The capture routine that runs inside the page.
 *
 * It must stay self-contained: `page.evaluate` serialises this function and
 * runs it in the browser, so it may only reference browser globals, the
 * injected `window.SPECTOR` bundle and its own arguments.
 */
export async function captureFrameInPage(options) {
  const {
    timeoutMs = 240_000,
    fullCapture = false,
    quickCapture = true,
    scenario = 'frame',
    keepCommands = false,
    spectorVersion = null,
  } = options ?? {};

  const canvas = document.querySelector('canvas.screen-space__canvas');
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('screen-space canvas not found');
  }
  if (!window.SPECTOR || typeof window.SPECTOR.Spector !== 'function') {
    throw new Error('Spector bundle is not installed on the page');
  }

  if (!window.__sfSpector) {
    const spector = new window.SPECTOR.Spector();
    window.__sfSpErrors = [];
    spector.onError.add((message) => {
      window.__sfSpErrors.push(String(message));
    });
    window.__sfSpector = spector;
  }

  const spector = window.__sfSpector;
  window.__sfSpErrors.length = 0;

  // Spector tags and records every GL call while its spy is attached, which
  // drops the preview to under 1 fps. Keep it attached only for the capture.
  for (const entry of spector.getAvailableContexts()) {
    try {
      entry.contextSpy.spy();
    } catch {
      // Already attached.
    }
  }

  const detach = () => {
    for (const entry of spector.getAvailableContexts()) {
      try {
        entry.contextSpy.unSpy();
      } catch {
        // A context that cannot be detached only slows the page down; the
        // capture itself is already complete.
      }
    }
  };

  const wallStart = performance.now();
  const dateStart = Date.now();
  let autoStopped = false;

  try {
    const captured = new Promise((resolve) => {
      const observerId = spector.onCapture.add((value) => {
        spector.onCapture.remove(observerId);
        autoStopped = true;
        resolve(value);
      });
    });

    // `captureNextFrame` arms the spy for one requestAnimationFrame frame.
    // Quick capture skips the per-texture readback Spector does for its UI
    // thumbnails; on software GL that readback dominates the capture.
    spector.captureNextFrame(canvas, quickCapture, fullCapture);

    let capture = await Promise.race([
      captured,
      new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);

    if (!capture) {
      // The frame may have ended before the observer was armed, or the render
      // loop may be idle: stop manually and keep whatever was recorded.
      try {
        capture = spector.stopCapture() ?? null;
      } catch {
        capture = null;
      }
    }

    const wallEnd = performance.now();
    const dateEnd = Date.now();
    const spectorErrors = window.__sfSpErrors.slice();

    if (
      !capture ||
      !Array.isArray(capture.commands) ||
      !capture.commands.length
    ) {
      throw new Error(
        `capture "${scenario}" produced no GL commands` +
          (spectorErrors.length ? `: ${spectorErrors.join('; ')}` : ''),
      );
    }

    return summarise(capture, {
      scenario,
      fullCapture,
      quickCapture,
      keepCommands,
      spectorVersion,
      spectorErrors,
      autoStopped,
      wallStart,
      wallEnd,
      dateStart,
      dateEnd,
    });
  } finally {
    detach();
  }

  function summarise(capture, meta) {
    const commands = capture.commands;

    const byName = new Map();
    const byStatus = new Map();
    const redundantByCommand = new Map();
    const redundantByOrigin = new Map();
    const timeByCommand = new Map();
    const draws = { calls: 0, instances: 0, kinds: {} };
    const uploads = {
      texImage2D: 0,
      texSubImage2D: 0,
      texImage3D: 0,
      bufferData: 0,
      bufferSubData: 0,
    };
    const unique = {
      programs: new Set(),
      textures: new Set(),
      buffers: new Set(),
      framebuffers: new Set(),
      vertexArrays: new Set(),
    };
    const glErrors = [];
    const shaders = [];
    const programs = [];

    // gl.drawBuffers also starts with "draw" but only sets MRT state.
    const DRAW_COMMANDS =
      /^(drawArrays|drawElements|drawArraysInstanced|drawElementsInstanced|drawRangeElements|multiDraw\w*)$/;

    const addObject = (set, object) => {
      // WebGL objects keep their identity for the life of the context, so a
      // Set of the arguments counts distinct programs, textures and buffers.
      if (object && typeof object === 'object') set.add(object);
    };

    for (const command of commands) {
      const name = command.name;
      byName.set(name, (byName.get(name) ?? 0) + 1);
      byStatus.set(command.status, (byStatus.get(command.status) ?? 0) + 1);

      const duration = Math.max(
        0,
        Number(command.commandEndTime ?? command.endTime ?? 0) -
          Number(command.startTime ?? 0),
      );
      if (Number.isFinite(duration)) {
        timeByCommand.set(name, (timeByCommand.get(name) ?? 0) + duration);
      }

      if (command.status === 30) {
        redundantByCommand.set(name, (redundantByCommand.get(name) ?? 0) + 1);
        const stack = Array.isArray(command.stackTrace)
          ? command.stackTrace
          : [];
        const origin = stack.length
          ? String(stack[0])
              .replace(/^at\s+/, '')
              .slice(0, 160)
          : '(no stack)';
        redundantByOrigin.set(origin, (redundantByOrigin.get(origin) ?? 0) + 1);
      }

      if (DRAW_COMMANDS.test(name)) {
        draws.calls += 1;
        draws.kinds[name] = (draws.kinds[name] ?? 0) + 1;
        if (name.includes('Instanced')) {
          const args = command.commandArguments;
          const last = Number(args?.[args.length - 1]);
          if (Number.isFinite(last)) draws.instances += last;
        }
      }

      if (uploads[name] !== undefined) uploads[name] += 1;

      if (name === 'useProgram') {
        addObject(unique.programs, command.commandArguments?.[0]);
      }
      if (name === 'bindTexture') {
        addObject(unique.textures, command.commandArguments?.[1]);
      }
      if (name === 'bindBuffer') {
        addObject(unique.buffers, command.commandArguments?.[1]);
      }
      if (name === 'bindFramebuffer') {
        addObject(unique.framebuffers, command.commandArguments?.[1]);
      }
      if (name === 'bindVertexArray') {
        addObject(unique.vertexArrays, command.commandArguments?.[0]);
      }

      if (name === 'getError') glErrors.push(command.result);

      if (command.shader) {
        shaders.push({
          shaderType: command.shader.shaderType,
          compiled: command.shader.COMPILE_STATUS,
          infoLog: (command.shader.infoLog ?? '').slice(0, 2000),
        });
      }
      if (command.program) {
        const status = command.program.programStatus ?? {};
        programs.push({
          linked: status.LINK_STATUS,
          validated: status.VALIDATE_STATUS,
          infoLog: (status.infoLog ?? '').slice(0, 2000),
          shaders: (command.program.shaders ?? []).map((shader) => ({
            shaderType: shader.shaderType,
            compiled: shader.COMPILE_STATUS,
            infoLog: (shader.infoLog ?? '').slice(0, 2000),
          })),
        });
      }
    }

    const round = (value) => Math.round(value * 1000) / 1000;
    const entriesDesc = (map) => [...map.entries()].sort((a, b) => b[1] - a[1]);
    const sum = (map) =>
      [...map.values()].reduce((total, value) => total + value, 0);

    const first = commands[0];
    const last = commands[commands.length - 1];

    return {
      meta: {
        scenario,
        capturedAt: new Date().toISOString(),
        autoStopped,
        fullCapture,
        quickCapture,
        spectorVersion,
        spectorErrors: meta.spectorErrors,
        userAgent: navigator.userAgent,
      },
      clock: {
        wallMs: round(meta.wallEnd - meta.wallStart),
        dateMs: meta.dateEnd - meta.dateStart,
        pageNowAtCapture: round(meta.wallEnd),
        captureStartTime: round(Number(capture.startTime ?? 0)),
        captureEndTime: round(Number(capture.endTime ?? 0)),
        listenStart: round(Number(capture.listenCommandsStartTime ?? 0)),
        listenEnd: round(Number(capture.listenCommandsEndTime ?? 0)),
        firstCommandStart: round(Number(first?.startTime ?? 0)),
        lastCommandEnd: round(Number(last?.commandEndTime ?? 0)),
      },
      canvas: capture.canvas,
      context: {
        version: capture.context?.version ?? null,
        capabilities: capture.context?.capabilities ?? {},
        extensions: capture.context?.extensions ?? {},
      },
      commandCount: commands.length,
      byName: entriesDesc(byName),
      byStatus: entriesDesc(byStatus),
      draws: {
        calls: draws.calls,
        instances: draws.instances,
        kinds: draws.kinds,
      },
      uniqueObjects: Object.fromEntries(
        Object.entries(unique).map(([key, set]) => [key, set.size]),
      ),
      uploads,
      redundant: {
        total: sum(redundantByCommand),
        byCommand: entriesDesc(redundantByCommand),
        byOrigin: entriesDesc(redundantByOrigin).slice(0, 25),
      },
      cpuTimeByCommand: entriesDesc(
        new Map(
          [...timeByCommand.entries()].map(([key, value]) => [
            key,
            round(value),
          ]),
        ),
      ).slice(0, 25),
      glErrors,
      shaders,
      programs,
      frameMemory: capture.frameMemory ?? {},
      analyses: (capture.analyses ?? []).map((analysis) => ({
        name: analysis.analyserName,
        total: analysis.total ?? null,
        draw: analysis.draw ?? null,
        clear: analysis.clear ?? null,
        triangles: analysis.triangles ?? null,
      })),
      commands: keepCommands
        ? commands.map((command) => ({
            n: command.name,
            t: command.text,
            s: command.status,
            d: round(
              Math.max(
                0,
                Number(command.commandEndTime ?? command.endTime ?? 0) -
                  Number(command.startTime ?? 0),
              ),
            ),
          }))
        : undefined,
    };
  }
}
