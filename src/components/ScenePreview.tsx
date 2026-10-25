
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

interface ScenePreviewProps {
  fragmentShader: string
  onShaderError: (error: string | null) => void
}

const vertexShader = `
  varying vec3 vPosition;

  void main() {
    vPosition = position;

    gl_Position = projectionMatrix
                * modelViewMatrix
                * vec4(position, 1.0);
  }
`

export default function ScenePreview({
  fragmentShader,
  onShaderError,
}: ScenePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const materialRef = useRef<THREE.ShaderMaterial | null>(null)
  const fragmentShaderRef = useRef(fragmentShader)
  const onShaderErrorRef = useRef(onShaderError)

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

    const camera = new THREE.PerspectiveCamera(
      50,
      1,
      0.1,
      100,
    )
    camera.position.z = 3

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    const geometry = new THREE.SphereGeometry(1, 48, 32)

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader: fragmentShaderRef.current,
    })

    materialRef.current = material

    const sphere = new THREE.Mesh(geometry, material)
    scene.add(sphere)

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

    // Report shader compilation errors after rendering.
renderer.debug.onShaderError = (
      gl,
      _program,
      vertexShaderObject,
      fragmentShaderObject,
    ) => {
      const vertexLog = gl.getShaderInfoLog(vertexShaderObject)
      const fragmentLog = gl.getShaderInfoLog(fragmentShaderObject)
      const logs = [vertexLog, fragmentLog].filter(Boolean)

      onShaderErrorRef.current(
        logs.length ? logs.join('\n') : 'Shader compilation failed.',
      )
    }

    // Three.js can report compilation errors through its debug callback.
    renderer.debug.onShaderError = (
      gl,
      _program,
      vertexShaderObject,
      fragmentShaderObject,
    ) => {
      const vertexLog = gl.getShaderInfoLog(vertexShaderObject)
      const fragmentLog = gl.getShaderInfoLog(fragmentShaderObject)
      const logs = [vertexLog, fragmentLog].filter(Boolean)

      onShaderErrorRef.current(
        logs.length ? logs.join('\n') : 'Shader compilation failed.',
      )
    }

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

  // Apply new shader source without restarting the animation loop.
  useEffect(() => {
    const material = materialRef.current
    if (!material) return

    material.fragmentShader = fragmentShader
    material.needsUpdate = true
    onShaderErrorRef.current(null)
  }, [fragmentShader])

  return <div ref={containerRef} className="scene-preview" />
}
