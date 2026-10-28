import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'

const HEIGHT_SCALE = 3.2
const WHEEL_BASE_Y = 0.48
const SUSPENSION_TOP_Y = 0.78
const AXLES = { front: -1.17, rear: 1.03 }
const MUSTANG_URL = `${import.meta.env.BASE_URL}models/mustang.glb`

function Wheel({ x, z, signal, currentRef }) {
  const ref = useRef()
  useFrame((_, delta) => {
    if (!ref.current) return
    const current = currentRef.current
    ref.current.position.y = WHEEL_BASE_Y + current[signal] * HEIGHT_SCALE
    ref.current.rotation.x -= delta * 8
  })
  return (
    <group ref={ref} position={[x, WHEEL_BASE_Y, z]}>
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

function SuspensionStrut({ x, z, inputSignal, outputSignal, currentRef }) {
  const ref = useRef()

  useFrame(() => {
    if (!ref.current) return
    const current = currentRef.current
    const wheelTop = WHEEL_BASE_Y + current[inputSignal] * HEIGHT_SCALE + 0.06
    const bodyAnchor = SUSPENSION_TOP_Y + current[outputSignal] * HEIGHT_SCALE
    const length = Math.max(0.08, Math.abs(bodyAnchor - wheelTop))
    ref.current.position.y = (bodyAnchor + wheelTop) * 0.5
    ref.current.scale.y = length
  })

  return (
    <mesh ref={ref} position={[x * 0.84, (SUSPENSION_TOP_Y + WHEEL_BASE_Y) * 0.5, z]} castShadow>
      <cylinderGeometry args={[0.025, 0.035, 1, 12]} />
      <meshStandardMaterial color="#f4bf4f" emissive="#8a5208" emissiveIntensity={0.45} metalness={0.55} roughness={0.28} />
    </mesh>
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
    body.current.rotation.x = current.pitch * HEIGHT_SCALE
  })

  return (
    <group>
      <Wheel x={-0.78} z={AXLES.front} signal="xFront" currentRef={currentRef} />
      <Wheel x={0.78} z={AXLES.front} signal="xFront" currentRef={currentRef} />
      <Wheel x={-0.78} z={AXLES.rear} signal="xRear" currentRef={currentRef} />
      <Wheel x={0.78} z={AXLES.rear} signal="xRear" currentRef={currentRef} />

      <SuspensionStrut x={-0.78} z={AXLES.front} inputSignal="xFront" outputSignal="yFront" currentRef={currentRef} />
      <SuspensionStrut x={0.78} z={AXLES.front} inputSignal="xFront" outputSignal="yFront" currentRef={currentRef} />
      <SuspensionStrut x={-0.78} z={AXLES.rear} inputSignal="xRear" outputSignal="yRear" currentRef={currentRef} />
      <SuspensionStrut x={0.78} z={AXLES.rear} inputSignal="xRear" outputSignal="yRear" currentRef={currentRef} />

      <group ref={body} position={[0, 1.08, 0]}>
        <primitive object={mustang} position={[0, -0.71, 0]} />
      </group>
    </group>
  )
}

useGLTF.preload(MUSTANG_URL)
