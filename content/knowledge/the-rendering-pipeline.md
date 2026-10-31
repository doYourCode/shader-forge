---
title: The Rendering Pipeline
description: How vertex data becomes pixels on screen.
section: basics
order: 1
draft: false
---

## The short version

The GPU takes vertex data through the **vertex shader**, assembles primitives,
rasterizes them, and runs the **fragment shader** for every covered pixel.

## Stages

1. **Vertex processing** — transform positions from model space to clip space.
2. **Primitive assembly** — build triangles from vertices.
3. **Rasterization** — decide which pixels each triangle covers.
4. **Fragment processing** — compute a color per pixel.
5. **Output merging** — depth test, blending, and write to the framebuffer.

> Branching in a fragment shader is expensive. Prefer `mix()` and `step()` over
> `if` when the result is per-pixel.