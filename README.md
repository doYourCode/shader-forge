<<<<<<< HEAD
# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
=======
# Classic Games
A collection of classic video game reimplementations built with modern C# techniques and the MonoGame framework, exploring the design and mechanics of timeless games through contemporary development practices.

## Goals
- Recreate classic video games from scratch.
- Study game mechanics, collision detection, rendering, and input handling.
- Practice programming fundamentals and software design.
- Explore game development techniques through increasingly complex projects.

## Projects
This repository will grow as new games and experiments are developed.
Each project may include its own source code, documentation, and instructions for building and running it.

## Technologies
- [C#](https://dotnet.microsoft.com/en-us/languages/csharp) is an open-source and cross-platform programming language.
- [MonoGame](https://monogame.net/) is an open-source modern reimplementation of the XNA framework.
- [Monogame-Extended](https://github.com/MonoGame-Extended/Monogame-Extended) is a set of utilities (in the form of libraries/tools) that extends MonoGame with new functionality.

## License
This project is licensed under the GNU General Public License v3.0 (GPL-3.0). See the LICENSE file for details.
>>>>>>> origin/main
