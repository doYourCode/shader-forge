# AGENTS.md — ShaderForge Development Guidelines

## Project Context

ShaderForge is a TypeScript + Vue 3 + Vite application for editing, compiling, and previewing GLSL/WGSL shaders using Babylon.js and CodeMirror.

## Core Engineering Principles

All implementations MUST follow these principles:

- **SOLID:** Especially Single Responsibility and Dependency Inversion.
- **KISS:** Prefer simple, straightforward solutions.
- **DRY:** Avoid unnecessary code duplication.
- **YAGNI:** Avoid implementing unrequested features or premature abstractions.
- **Separation of Concerns:** Keep UI, application logic, state management, and rendering independent.
- **Composition over Inheritance:** Prefer composables and modular services.
- **Encapsulation:** Expose minimal, well-defined public APIs.

## TypeScript Guidelines

- Enable and respect strict TypeScript typing.
- Avoid `any`; use `unknown` when appropriate.
- Define explicit interfaces and types for module contracts.
- Prefer discriminated unions for application states.
- Avoid unnecessary type assertions.
- Use `readonly` where applicable.
- Handle nullable values explicitly.

## Vue Guidelines

- Use Vue 3 Composition API and `<script setup>`.
- Keep components small and focused.
- Extract reusable logic into composables.
- Use computed properties for derived state.
- Avoid unnecessary watchers.
- Keep business logic outside templates.
- Use props and emits for component communication.
- Introduce Pinia only when justified by shared state requirements.

## Architecture Guidelines

- Keep the shader engine independent of Vue.
- Never manipulate Babylon.js objects directly from UI components.
- Separate shader editing, compilation, rendering, and state management.
- Define clear interfaces for GLSL and WGSL implementations.
- Establish explicit ownership and disposal of rendering resources.
- Preserve the last successfully compiled shader when compilation fails.
- Minimize coupling between modules.

## Quality and Performance

- Follow consistent naming conventions and project formatting.
- Use ESLint and Prettier.
- Write unit tests for utilities, services, and state management.
- Test integration between the editor and rendering engine.
- Handle errors explicitly and provide meaningful feedback.
- Dispose of Babylon.js resources, observers, materials, and textures appropriately.
- Avoid unnecessary reactive updates and rendering operations.

## AI Agent Instructions

Before implementing any change:

1. Inspect the existing architecture and relevant files.
2. Understand existing conventions and reuse established patterns.
3. Identify architectural implications before modifying modules.
4. Avoid unnecessary dependencies, abstractions, or refactoring.
5. Do not duplicate existing functionality.
6. Preserve existing functionality unless explicitly instructed otherwise.

After implementation:

1. Verify TypeScript types and resolve compilation errors.
2. Run relevant tests and lint checks.
3. Review resource lifecycle and potential memory leaks.
4. Summarize modifications and any remaining limitations.

**IMPORTANT:** Prioritize maintainability, modularity, type safety, and consistency with the existing architecture. Do not sacrifice architectural integrity for implementation speed.
