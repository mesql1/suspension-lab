import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const WIDTH_SEGMENTS = 10
const LENGTH_SEGMENTS = 90
const ROAD_WIDTH = 7
const Z_START = -5
const Z_END = 35
const HEIGHT_SCALE = 3.2

function createRoadGeometry() {
  const positions = new Float32Array((WIDTH_SEGMENTS + 1) * (LENGTH_SEGMENTS + 1) * 3)
  const indices = []
  let p = 0
  for (let iz = 0; iz <= LENGTH_SEGMENTS; iz += 1) {
    const z = Z_START + (Z_END - Z_START) * iz / LENGTH_SEGMENTS
    for (let ix = 0; ix <= WIDTH_SEGMENTS; ix += 1) {
      positions[p++] = -ROAD_WIDTH / 2 + ROAD_WIDTH * ix / WIDTH_SEGMENTS
      positions[p++] = 0
      positions[p++] = z
    }
  }
  for (let iz = 0; iz < LENGTH_SEGMENTS; iz += 1) {
    for (let ix = 0; ix < WIDTH_SEGMENTS; ix += 1) {
      const a = iz * (WIDTH_SEGMENTS + 1) + ix
      const b = a + WIDTH_SEGMENTS + 1
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export function RollingRoad({ engine }) {
  const geometry = useMemo(createRoadGeometry, [])
  const frameCount = useRef(0)

  useFrame(() => {
    const positions = geometry.attributes.position.array
    let p = 0
    for (let iz = 0; iz <= LENGTH_SEGMENTS; iz += 1) {
      const z = Z_START + (Z_END - Z_START) * iz / LENGTH_SEGMENTS
      const distance = Math.max(0, z + 1.35)
      const baseY = engine.roadAtDistance(distance) * HEIGHT_SCALE
      for (let ix = 0; ix <= WIDTH_SEGMENTS; ix += 1) {
        p += 1
        const shoulder = Math.abs(ix - WIDTH_SEGMENTS / 2) / (WIDTH_SEGMENTS / 2)
        positions[p++] = baseY - Math.max(0, shoulder - 0.72) * 0.04
        p += 1
      }
    }
    geometry.attributes.position.needsUpdate = true
    frameCount.current += 1
    if (frameCount.current % 8 === 0) geometry.computeVertexNormals()
  })

  return (
    <>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial color="#111214" roughness={0.96} metalness={0.01} side={THREE.DoubleSide} />
      </mesh>
      <LaneMarkers engine={engine} />
    </>
  )
}

function LaneMarkers({ engine }) {
  const group = useRef()
  useFrame(() => {
    if (!group.current) return
    group.current.position.z = (engine.time * engine.params.speed) % 4
    for (const child of group.current.children) {
      child.position.y = 0.025 + engine.roadAtDistance(Math.max(0, child.position.z + group.current.position.z + 1.35)) * HEIGHT_SCALE
    }
  })
  return (
    <group ref={group}>
      {Array.from({ length: 12 }, (_, i) => (
        <mesh key={i} position={[0, 0.025, Z_START + i * 4]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.11, 1.8]} />
          <meshBasicMaterial color="#e0b83f" />
        </mesh>
      ))}
    </group>
  )
}
