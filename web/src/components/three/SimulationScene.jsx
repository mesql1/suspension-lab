import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { RollingRoad } from './RollingRoad'
import { Vehicle } from './Vehicle'

function Simulation({ engine }) {
  return (
    <>
      <color attach="background" args={['#090a0b']} />
      <fog attach="fog" args={['#090a0b', 13, 44]} />
      <ambientLight intensity={0.52} color="#ffffff" />
      <hemisphereLight args={['#f2f2f2', '#1a1a1a', 1.05]} />
      <directionalLight position={[6, 10, -5]} intensity={3.1} color="#ffffff" castShadow shadow-mapSize={[2048, 2048]} />
      <directionalLight position={[-5, 4, -1]} intensity={1.15} color="#cfd2d5" />
      <pointLight position={[-3, 3, 4]} intensity={8} color="#ffffff" distance={18} />
      <pointLight position={[3, 2, -4]} intensity={5} color="#d9d9d9" distance={14} />
      <RollingRoad engine={engine} />
      <Suspense fallback={null}>
        <Vehicle engine={engine} />
      </Suspense>
      <OrbitControls target={[0, 0.7, 1]} enableDamping minDistance={4} maxDistance={16} maxPolarAngle={Math.PI * 0.48} />
    </>
  )
}

export function SimulationScene({ engine }) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.6]}
      camera={{ position: [5.5, 3.8, -6.8], fov: 42 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.18
      }}
    >
      <Simulation engine={engine} />
    </Canvas>
  )
}
