import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CONFIG } from '../../config';

interface GroundFogProps {
  opacity?: number;
  color?: string;
  treeHeight?: number;
  treeRadius?: number;
  showGround?: boolean;
  groundColor?: string;
}

export const GroundFog = ({ 
  opacity = 0.3, 
  color = '#ffffff',
  treeHeight,
  treeRadius,
  showGround = true,
  groundColor = '#1a1a2e'
}: GroundFogProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  const actualHeight = treeHeight ?? CONFIG.tree.height;
  const actualRadius = treeRadius ?? CONFIG.tree.radius;
  const groundSize = actualRadius * 2.5;

  useFrame((state) => {
    if (meshRef.current) {
      const time = state.clock.elapsedTime;
      meshRef.current.rotation.z = Math.sin(time * 0.2) * 0.05;
      (meshRef.current.material as THREE.MeshBasicMaterial).opacity = opacity * (0.8 + Math.sin(time * 0.5) * 0.2);
    }
  });

  return (
    <group>
      {/* 实体地板 */}
      {showGround && (
        <mesh position={[0, -actualHeight / 2 - 3.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[groundSize, 64]} />
          <meshStandardMaterial
            color={groundColor}
            roughness={0.8}
            metalness={0.2}
          />
        </mesh>
      )}
      {/* 雾气效果 */}
      <mesh ref={meshRef} position={[0, -actualHeight / 2 - 3, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[groundSize * 1.2, 64]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={opacity}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
};
