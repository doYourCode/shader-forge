
import { useState } from 'react'
import './App.css'
import ShaderEditor from './components/ShaderEditor'
import ScenePreview from './components/ScenePreview'

const DEFAULT_VERTEX_SHADER = `
varying vec3 vPosition;

void main() {
  vPosition = position;

  gl_Position = projectionMatrix
              * modelViewMatrix
              * vec4(position, 1.0);
}
`

const DEFAULT_FRAGMENT_SHADER = `
varying vec3 vPosition;

void main() {
  vec3 color = vec3(1.0, 0.3, 0.2);
  gl_FragColor = vec4(color, 1.0);
}
`

function App() {
  const [vertexShaderSource, setVertexShaderSource] =
    useState(DEFAULT_VERTEX_SHADER)
  const [fragmentShaderSource, setFragmentShaderSource] =
    useState(DEFAULT_FRAGMENT_SHADER)

  const [appliedVertexShader, setAppliedVertexShader] =
    useState(DEFAULT_VERTEX_SHADER)
  const [appliedFragmentShader, setAppliedFragmentShader] =
    useState(DEFAULT_FRAGMENT_SHADER)

  const [shaderError, setShaderError] = useState<string | null>(null)

  const [activeShaderTab, setActiveShaderTab] =
  useState<'vertex' | 'fragment'>('fragment')

  function resetShader() {
    setVertexShaderSource(DEFAULT_VERTEX_SHADER)
    setFragmentShaderSource(DEFAULT_FRAGMENT_SHADER)
  }

  function runShader() {
    setAppliedVertexShader(vertexShaderSource)
    setAppliedFragmentShader(fragmentShaderSource)
    setShaderError(null)
  }

  return (
    <main className="app is-flex is-flex-direction-column is-dark">
      <header className="navbar app-toolbar" role="banner">
        <div className="navbar-brand is-align-items-center px-4">
          <span className="brand-icon">{'{ }'}</span>
          <span className="has-text-weight-semibold ml-3">
            ShaderForge
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

            <span className="tag is-dark is-small">GLSL</span>
          </header>

          <div className="editor-content">
            {activeShaderTab === 'vertex' ? (
              <ShaderEditor
                value={vertexShaderSource}
                onChange={setVertexShaderSource}
              />
            ) : (
              <ShaderEditor
                value={fragmentShaderSource}
                onChange={setFragmentShaderSource}
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
              onShaderError={setShaderError}
            />

            {shaderError && (
              <pre className="shader-error" role="alert">
                {shaderError}
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
