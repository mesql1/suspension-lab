import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { RollingRoad } from './RollingRoad'
import { Vehicle } from './Vehicle'

function Simulation({ engine }) {
  return (
    <>
      <color attach="background" args={['#071018']} />
      <fog attach="fog" args={['#071018', 12, 42]} />
      <ambientLight intensity={0.65} />
      <hemisphereLight args={['#b9eff3', '#132028', 1.15]} />
      <directionalLight position={[6, 10, -5]} intensity={2.2} color="#dffcff" castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[-4, 3, -4]} intensity={10} color="#1d7c91" />
      <RollingRoad engine={engine} />
      <Vehicle engine={engine} />
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
    >
      <Simulation engine={engine} />
    </Canvas>
  )
}
