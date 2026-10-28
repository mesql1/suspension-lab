import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'

const HEIGHT_SCALE = 3.2
const AXLES = { front: -1.35, rear: 1.35 }

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
        <cylinderGeometry args={[0.36, 0.36, 0.28, 24]} />
        <meshStandardMaterial color="#11181d" roughness={0.74} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.19, 0.19, 0.3, 16]} />
        <meshStandardMaterial color="#7b8b92" metalness={0.75} roughness={0.28} />
      </mesh>
    </group>
  )
}

export function Vehicle({ engine }) {
  const body = useRef()
  const cabin = useRef()
  const currentRef = useRef(engine.current)

  useFrame(() => {
    const current = engine.current
    currentRef.current = current
    if (!body.current) return
    body.current.position.y = 1.08 + current.y * HEIGHT_SCALE
    body.current.rotation.x = -current.pitch * 3
    if (cabin.current) cabin.current.position.y = 0.34 + Math.sin(engine.time * 1.4) * 0.004
  })

  return (
    <group>
      <Wheel x={-0.82} z={AXLES.front} signal="xFront" currentRef={currentRef} />
      <Wheel x={0.82} z={AXLES.front} signal="xFront" currentRef={currentRef} />
      <Wheel x={-0.82} z={AXLES.rear} signal="xRear" currentRef={currentRef} />
      <Wheel x={0.82} z={AXLES.rear} signal="xRear" currentRef={currentRef} />

      <group ref={body} position={[0, 1.08, 0]}>
        <mesh castShadow>
          <boxGeometry args={[1.72, 0.32, 3.45]} />
          <meshStandardMaterial color="#39c3d0" metalness={0.58} roughness={0.24} />
        </mesh>
        <mesh ref={cabin} position={[0, 0.34, 0.22]} castShadow>
          <boxGeometry args={[1.45, 0.62, 1.78]} />
          <meshStandardMaterial color="#a7f4f0" metalness={0.25} roughness={0.19} />
        </mesh>
        <mesh position={[0, 0.35, -0.69]}>
          <boxGeometry args={[1.31, 0.48, 0.03]} />
          <meshStandardMaterial color="#163746" metalness={0.35} roughness={0.12} transparent opacity={0.85} />
        </mesh>
        <mesh position={[0, 0.13, -1.77]}>
          <boxGeometry args={[1.52, 0.14, 0.13]} />
          <meshStandardMaterial color="#dffcff" emissive="#5ee7f0" emissiveIntensity={0.9} />
        </mesh>
      </group>
    </group>
  )
}
