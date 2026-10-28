import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'

const HEIGHT_SCALE = 3.2
const AXLES = { front: -1.17, rear: 1.03 }
const MUSTANG_URL = `${import.meta.env.BASE_URL}models/mustang.glb`

function Wheel({ x, z, signal, currentRef }) {
  const ref = useRef()
  useFrame((_, delta) => {
    if (!ref.current) return
    ref.current.position.y = 0.48 + currentRef.current[signal] * HEIGHT_SCALE
    ref.current.rotation.x -= delta * 8
  })
  return (
    <group ref={ref} position={[x, 0.48, z]}>
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.3, 0.3, 0.26, 24]} />
        <meshStandardMaterial color="#11181d" roughness={0.74} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.16, 0.16, 0.28, 16]} />
        <meshStandardMaterial color="#7b8b92" metalness={0.75} roughness={0.28} />
      </mesh>
    </group>
  )
}

export function Vehicle({ engine }) {
  const body = useRef()
  const currentRef = useRef(engine.current)
  const { scene } = useGLTF(MUSTANG_URL)
  const mustang = useMemo(() => {
    const clone = scene.clone(true)
    clone.traverse((node) => {
      if (!node.isMesh) return
      node.castShadow = true
      node.receiveShadow = true
    })
    return clone
  }, [scene])

  useFrame(() => {
    const current = engine.current
    currentRef.current = current
    if (!body.current) return
    body.current.position.y = 1.08 + current.y * HEIGHT_SCALE
    body.current.rotation.x = -current.pitch * 3
  })

  return (
    <group>
      <Wheel x={-0.82} z={AXLES.front} signal="xFront" currentRef={currentRef} />
      <Wheel x={0.82} z={AXLES.front} signal="xFront" currentRef={currentRef} />
      <Wheel x={-0.82} z={AXLES.rear} signal="xRear" currentRef={currentRef} />
      <Wheel x={0.82} z={AXLES.rear} signal="xRear" currentRef={currentRef} />

      <group ref={body} position={[0, 1.08, 0]}>
        <primitive object={mustang} position={[0, -0.71, 0]} />
      </group>
    </group>
  )
}

useGLTF.preload(MUSTANG_URL)
