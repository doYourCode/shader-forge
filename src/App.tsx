
import { useState } from 'react'
import './App.css'
import ShaderEditor from './components/ShaderEditor'
import ScenePreview from './components/ScenePreview'

import type { ShaderDiagnostic } from './types/shader'

import defaultVertexShader from './shaders/default.vert.glsl?raw';
import defaultFragmentShader from './shaders/default.frag.glsl?raw';

function App() {
  const [vertexShaderSource, setVertexShaderSource] =
    useState(defaultVertexShader)
  const [fragmentShaderSource, setFragmentShaderSource] =
    useState(defaultFragmentShader)

  const [appliedVertexShader, setAppliedVertexShader] =
    useState(defaultVertexShader)
  const [appliedFragmentShader, setAppliedFragmentShader] =
    useState(defaultFragmentShader)

  const [shaderDiagnostics, setShaderDiagnostics] = useState<ShaderDiagnostic[]>([])

  const [activeShaderTab, setActiveShaderTab] =
  useState<'vertex' | 'fragment'>('fragment')

  const [shaderColor, setShaderColor] = useState('#6699ff');

  function resetShader() {
    setVertexShaderSource(defaultVertexShader)
    setFragmentShaderSource(defaultFragmentShader)
  }

  function runShader() {
    setAppliedVertexShader(vertexShaderSource)
    setAppliedFragmentShader(fragmentShaderSource)
    setShaderDiagnostics([])
  }

  return (
    <main className="app is-flex is-flex-direction-column is-dark">
      <header className="navbar app-toolbar" role="banner">
        <div className="navbar-brand is-align-items-center px-4">
          <img
            src={`${import.meta.env.BASE_URL}favicon.ico`}
            alt=""
            className="brand-icon"
          />
          <span className="has-text-weight-semibold ml-3">
            shaderForge
          </span>
        </div>

        <div className="navbar-end is-flex is-align-items-center px-4">
          <span className="project-name mr-4">
            Untitled shader
          </span>

          <div className="buttons are-small mb-0">
            <button
              className="button is-dark is-outlined"
              type="button"
              onClick={resetShader}
            >
              Reset
            </button>

            <button
              className="button is-primary"
              type="button"
              onClick={runShader}
            >
              Run shader
            </button>
          </div>
        </div>
      </header>

      <section className="workspace is-flex">
        <section className="panel editor-panel is-flex is-flex-direction-column">
          <header className="panel-heading shader-tabs is-flex is-justify-content-space-between is-align-items-center">
            <div
              className="shader-tab-list"
              role="tablist"
              aria-label="Shader stage"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeShaderTab === 'vertex'}
                className={`shader-tab ${activeShaderTab === 'vertex' ? 'is-active' : ''}`}
                onClick={() => setActiveShaderTab('vertex')}
              >
                Vertex Shader
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeShaderTab === 'fragment'}
                className={`shader-tab ${activeShaderTab === 'fragment' ? 'is-active' : ''}`}
                onClick={() => setActiveShaderTab('fragment')}
              >
                Fragment Shader
              </button>
            </div>

            <div className="shader-controls">
              <label>
                Color
                <input
                  type="color"
                  value={shaderColor}
                  onChange={(event) => setShaderColor(event.target.value)}
                />
              </label>
            </div>

            <span className="tag is-dark is-small">GLSL</span>
          </header>

          <div className="editor-content">
            {activeShaderTab === 'vertex' ? (
              <ShaderEditor
                value={vertexShaderSource}
                onChange={setVertexShaderSource}
                errorLines={shaderDiagnostics
                  .filter(
                    (diagnostic) =>
                      diagnostic.stage === 'vertex' &&
                      diagnostic.line !== null,
                  )
                  .map((diagnostic) => diagnostic.line!)}
              />
            ) : (
              <ShaderEditor
                value={fragmentShaderSource}
                onChange={setFragmentShaderSource}
                errorLines={shaderDiagnostics
                  .filter(
                    (diagnostic) =>
                      diagnostic.stage === 'fragment' &&
                      diagnostic.line !== null,
                  )
                  .map((diagnostic) => diagnostic.line!)}
              />
            )}
          </div>

          <footer className="panel-footer is-flex is-justify-content-space-between">
            <span>
              {activeShaderTab === 'vertex' ? 'Vertex shader' : 'Fragment shader'}
            </span>
            <span>GLSL</span>
          </footer>
        </section>


        <div
          className="panel-divider"
          role="separator"
          aria-orientation="vertical"
          aria-label="Editor and scene divider"
        />

        <section className="panel scene-panel is-flex is-flex-direction-column">
          <header className="panel-heading is-flex is-justify-content-space-between is-align-items-center">
            <span>SCENE VIEW</span>
            <span className="tag is-dark is-small">3D PREVIEW</span>
          </header>

          <div className="scene-content">
            <ScenePreview
              vertexShader={appliedVertexShader}
              fragmentShader={appliedFragmentShader}
              onShaderError={setShaderDiagnostics}
              shaderColor={shaderColor}
            />

            {shaderDiagnostics.length > 0 && (
              <pre className="shader-error" role="alert">
                {shaderDiagnostics.map((diagnostic, index) => (
                  <div key={`${diagnostic.stage}-${diagnostic.line}-${index}`}>
                    <strong>
                      {diagnostic.stage === 'program'
                        ? 'Program'
                        : `${diagnostic.stage === 'vertex' ? 'Vertex' : 'Fragment'} shader`}
                      {diagnostic.line !== null ? ` — line ${diagnostic.line}` : ''}
                    </strong>
                    {'\n'}
                    {diagnostic.message}
                  </div>
                ))}
              </pre>
            )}

            <div className="scene-overlay tag is-dark">
              <span className="status-dot mr-2" />
              WebGL preview
            </div>
          </div>

          <footer className="panel-footer is-flex is-justify-content-space-between">
            <span>Perspective camera</span>
            <span>Preview only</span>
          </footer>
        </section>
      </section>

      <footer className="statusbar is-flex is-justify-content-space-between is-align-items-center px-3">
        <span className="is-flex is-align-items-center">
          <span className="status-dot mr-2" />
          Ready
        </span>
        <span>ShaderLab · Browser edition</span>
      </footer>
    </main>
  )
}

export default App
