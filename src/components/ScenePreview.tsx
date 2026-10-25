
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

interface ScenePreviewProps {
  vertexShader: string
  fragmentShader: string
  onShaderError: (error: string | null) => void
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
      const vertexLog = gl.getShaderInfoLog(vertexShaderObject)?.trim()
      const fragmentLog = gl.getShaderInfoLog(fragmentShaderObject)?.trim()
      const programLog = gl.getProgramInfoLog(program)?.trim()

      const errors: string[] = []

      if (vertexLog) {
        errors.push(`Vertex shader:\n${vertexLog}`)
      }

      if (fragmentLog) {
        errors.push(`Fragment shader:\n${fragmentLog}`)
      }

      if (programLog) {
        errors.push(`Shader program:\n${programLog}`)
      }

      onShaderErrorRef.current(
        errors.length
          ? errors.join('\n\n')
          : 'Shader compilation or linking failed. Check both shader stages.',
      )
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

    onShaderErrorRef.current(null)
  }, [vertexShader, fragmentShader])

  return <div ref={containerRef} className="scene-preview" />
}
