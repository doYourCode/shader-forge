
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { ShaderDiagnostic, ShaderStage } from '../types/shader'

interface ScenePreviewProps {
  vertexShader: string
  fragmentShader: string
  onShaderError: (diagnostics: ShaderDiagnostic[]) => void
}

function findSourceStartLine(
  compiledSource: string,
  editorSource: string,
): number | null {
  const compiledLines = compiledSource.split('\n')
  const editorLines = editorSource.split('\n')

  const firstEditorLine = editorLines.findIndex(
    (line) => line.trim().length > 0,
  )

  if (firstEditorLine === -1) return null

  const firstSourceLine = editorLines[firstEditorLine].trim()

  const compiledIndex = compiledLines.findIndex(
    (line) => line.trim() === firstSourceLine,
  )

  if (compiledIndex === -1) return null

  // Return the compiled line corresponding to editor line 1.
  return compiledIndex - firstEditorLine + 1
}

function parseShaderLog(
  log: string,
  stage: ShaderStage,
  sourceStartLine: number | null,
): ShaderDiagnostic[] {
  if (!log.trim()) return []

  return log
    .split('\n')
    .map((message) => message.trim())
    .filter(Boolean)
    .map((message) => {
      // Common WebGL log formats:
      // ERROR: 0:12: ...
      // 0:12(3): error ...
      // 0(12) : error ...
      const match =
        message.match(/(?:ERROR:\s*)?\d+:(\d+)(?:\(\d+\))?:/) ??
        message.match(/\d+\((\d+)\)/)

const compilerLine = match ? Number(match[1]) : null

return {
  stage,
  line:
    compilerLine !== null && sourceStartLine !== null
      ? compilerLine - sourceStartLine + 1
      : null,
  message,
}
    })
}


export default function ScenePreview({
  vertexShader,
  fragmentShader,
  onShaderError,
}: ScenePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const materialRef = useRef<THREE.ShaderMaterial | null>(null)
  const vertexShaderRef = useRef(vertexShader)
  const fragmentShaderRef = useRef(fragmentShader)
  const onShaderErrorRef = useRef(onShaderError)

  useEffect(() => {
    vertexShaderRef.current = vertexShader
  }, [vertexShader])

  useEffect(() => {
    fragmentShaderRef.current = fragmentShader
  }, [fragmentShader])

  useEffect(() => {
    onShaderErrorRef.current = onShaderError
  }, [onShaderError])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#15171d')

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
    camera.position.z = 3

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    const geometry = new THREE.SphereGeometry(1, 48, 32)

    const material = new THREE.ShaderMaterial({
      vertexShader: vertexShaderRef.current,
      fragmentShader: fragmentShaderRef.current,
    })

    materialRef.current = material

    const sphere = new THREE.Mesh(geometry, material)
    scene.add(sphere)


    renderer.debug.onShaderError = (
      gl,
      program,
      vertexShaderObject,
      fragmentShaderObject,
    ) => {
      const vertexLog = gl.getShaderInfoLog(vertexShaderObject) ?? ''
      const fragmentLog = gl.getShaderInfoLog(fragmentShaderObject) ?? ''
      const programLog = gl.getProgramInfoLog(program) ?? ''

      const compiledVertexSource =
      gl.getShaderSource(vertexShaderObject) ?? ''

    const compiledFragmentSource =
      gl.getShaderSource(fragmentShaderObject) ?? ''

    const vertexSourceStartLine = findSourceStartLine(
      compiledVertexSource,
      vertexShaderRef.current,
    )

    const fragmentSourceStartLine = findSourceStartLine(
      compiledFragmentSource,
      fragmentShaderRef.current,
    )

    const diagnostics: ShaderDiagnostic[] = [
      ...parseShaderLog(
        vertexLog,
        'vertex',
        vertexSourceStartLine,
      ),
      ...parseShaderLog(
        fragmentLog,
        'fragment',
        fragmentSourceStartLine,
      ),
      ...parseShaderLog(programLog, 'program', null),
    ]

      if (diagnostics.length === 0) {
        diagnostics.push({
          stage: 'program',
          line: null,
          message: 'Shader compilation or linking failed. No detailed log was provided.',
        })
      }

      onShaderErrorRef.current(diagnostics)
    }


    const resizeObserver = new ResizeObserver(() => {
      const width = container.clientWidth
      const height = container.clientHeight

      if (width === 0 || height === 0) return

      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    })

    resizeObserver.observe(container)

    let animationId = 0

    const animate = () => {
      animationId = requestAnimationFrame(animate)
      sphere.rotation.y += 0.01
      sphere.rotation.x += 0.003
      renderer.render(scene, camera)
    }

    animate()

    return () => {
      cancelAnimationFrame(animationId)
      resizeObserver.disconnect()
      geometry.dispose()
      material.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      materialRef.current = null
    }
  }, [])

  useEffect(() => {
    const material = materialRef.current
    if (!material) return

    material.vertexShader = vertexShader
    material.fragmentShader = fragmentShader
    material.needsUpdate = true

    onShaderErrorRef.current([])
  }, [vertexShader, fragmentShader])

  return <div ref={containerRef} className="scene-preview" />
}
