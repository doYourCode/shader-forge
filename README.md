
# ShaderForge

An open-source browser-based GLSL shader editor built with React, TypeScript, and Three.js, designed to explore shader programming through an interactive development environment with real-time 3D previews.

## Goals

- Provide a lightweight, accessible environment for writing and experimenting with GLSL shaders.
- Visualize fragment shaders on 3D objects directly in the browser.
- Simplify shader development with syntax highlighting, shader execution, and compilation error reporting.
- Explore real-time rendering, GPU programming, and WebGL through a practical application.
- Develop an extensible foundation for future features, including shader parameters, customizable scenes, and additional rendering options.

## Features

- **GLSL Editor:** Write and edit fragment shader code using CodeMirror.
- **3D Preview:** Visualize shaders on a rotating sphere rendered with Three.js.
- **Shader Execution:** Apply edited shaders to the preview through an interactive control.
- **Error Reporting:** Display shader compilation errors to help identify and fix issues.
- **Browser-Based:** Run the application locally or deploy it as a static website without requiring a backend.

## Technologies

- [TypeScript](https://www.typescriptlang.org/) is a strongly typed programming language that builds on JavaScript.
- [React](https://react.dev/) is a library for building interactive user interfaces.
- [Three.js](https://threejs.org/) is a JavaScript 3D library for creating and rendering 3D graphics in the browser.
- [GLSL](https://www.khronos.org/opengl/wiki/Core_Language_(GLSL)) is a shading language used to program graphics processing units.
- [CodeMirror](https://codemirror.net/) is an extensible code editor component for the browser.
- [Vite](https://vite.dev/) is a frontend build tool and development server.
- [Bulma](https://bulma.io/) is a CSS framework used to build the user interface.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- npm

### Installation

Clone the repository and navigate to the project directory:

```bash
git clone https://github.com/doYourCode/shader-forge.git
cd shader-forge
```

Install the dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local URL printed in the terminal to access ShaderForge.

### Build

To create a production build, run:

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

## Project Status

ShaderForge is an early-stage open-source project under active development. Its current focus is establishing the core editing and rendering workflow, with further improvements planned as the project evolves.

## License

This project is licensed under the GNU General Public License v3.0 (GPL-3.0). See the `LICENSE` file for details.
