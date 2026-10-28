import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

const HEIGHT_SCALE = 3.2
const WHEEL_BASE_Y = 0.48
const SUSPENSION_TOP_Y = 0.78
const AXLES = { front: -1.17, rear: 1.03 }
const MUSTANG_URL = `${import.meta.env.BASE_URL}models/mustang.glb`

function createRealisticMaterial(source, nodeName) {
  const label = `${source?.name ?? ''} ${nodeName}`.toLowerCase()

  if (/glass|window/.test(label)) {
    return new THREE.MeshPhysicalMaterial({
      name: source.name,
      color: '#151719',
      metalness: 0.08,
      roughness: 0.12,
      transmission: 0.12,
      transparent: true,
      opacity: 0.82,
      side: THREE.DoubleSide,
    })
  }
  if (/head.light|low.light|white_light/.test(label)) {
    return new THREE.MeshStandardMaterial({ name: source.name, color: '#ffffff', emissive: '#f4f4ee', emissiveIntensity: 1.7, roughness: 0.12 })
  }
  if (/rear.*light/.test(label)) {
    return new THREE.MeshStandardMaterial({ name: source.name, color: '#6e1116', emissive: '#3c0508', emissiveIntensity: 0.75, roughness: 0.2 })
  }
  if (/gloss_red|body|arch|bumper|door|bonnet/.test(label)) {
    return new THREE.MeshPhysicalMaterial({
      name: source.name,
      color: '#e1e3e4',
      metalness: 0.62,
      roughness: 0.2,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
    })
  }
  if (/mirror/.test(label)) {
    return new THREE.MeshStandardMaterial({ name: source.name, color: '#d6d8d9', metalness: 0.95, roughness: 0.08 })
  }
  if (/grill|black|gap|splitter|cut.out|brake.vent|exhaust|matte_black|gloss_black/.test(label)) {
    return new THREE.MeshStandardMaterial({ name: source.name, color: '#090a0b', metalness: 0.45, roughness: 0.42 })
  }
  if (/number.plate/.test(label)) {
    return new THREE.MeshStandardMaterial({ name: source.name, color: '#d7d7d5', metalness: 0.06, roughness: 0.5 })
  }
  return new THREE.MeshStandardMaterial({ name: source.name, color: '#777a7c', metalness: 0.55, roughness: 0.34 })
}

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
        <meshStandardMaterial color="#070809" roughness={0.86} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.16, 0.16, 0.28, 16]} />
        <meshStandardMaterial color="#b8babc" metalness={0.9} roughness={0.2} />
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
      <meshStandardMaterial color="#9a9c9e" metalness={0.88} roughness={0.22} />
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
      node.material = Array.isArray(node.material)
        ? node.material.map((material) => createRealisticMaterial(material, node.name))
        : createRealisticMaterial(node.material, node.name)
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
