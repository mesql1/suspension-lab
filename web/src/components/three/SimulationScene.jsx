import { Suspense, useEffect, useRef } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { RollingRoad } from './RollingRoad'
import { Vehicle } from './Vehicle'

function ResponsiveCamera({ controlsRef }) {
  const { camera, size } = useThree()
  useEffect(() => {
    if (size.width < 600) {
      camera.position.set(5.8, 3.85, -7)
      camera.fov = 40
    } else {
      camera.position.set(8.2, 5.2, -9.8)
      camera.fov = 42
    }
    camera.lookAt(0, 0.65, 0)
    camera.updateProjectionMatrix()
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0.65, 0)
      controlsRef.current.update()
      controlsRef.current.saveState()
    }
  }, [camera, controlsRef, size.width])
  return null
}

function Simulation({ engine }) {
  const controlsRef = useRef(null)
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
      <ResponsiveCamera controlsRef={controlsRef} />
      <RollingRoad engine={engine} />
      <Suspense fallback={null}>
        <Vehicle engine={engine} />
      </Suspense>
      <OrbitControls ref={controlsRef} target={[0, 0.65, 0]} enableDamping minDistance={3.1} maxDistance={20} maxPolarAngle={Math.PI * 0.48} />
    </>
  )
}

export function SimulationScene({ engine }) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.6]}
      camera={{ position: [3.55, 2.45, -4.25], fov: 36 }}
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
