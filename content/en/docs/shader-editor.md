---
title: ShaderEditor
description: Manages the CodeMirror instance and the shader source.
section: api
order: 1
draft: false
---

## Overview

`ShaderEditor` owns the CodeMirror instance used by the editor view.

## Responsibilities

- Keep the editor state in sync with the current shader.
- Expose `getValue()` and `setValue()` for reading and replacing the source.
- Emit compile events so the viewer and status bar can react.