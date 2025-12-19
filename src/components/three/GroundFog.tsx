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
  // 缩小地板尺寸，不要太大
  const groundSize = actualRadius * 1.8;
  
  // 地板位置，雾气放在地板下方
  const groundY = -actualHeight / 2 - 3.5;
  const fogY = groundY - 0.5; // 雾气在地板下方

  useFrame((state) => {
    if (meshRef.current) {
      const time = state.clock.elapsedTime;
      meshRef.current.rotation.z = Math.sin(time * 0.2) * 0.05;
      (meshRef.current.material as THREE.MeshBasicMaterial).opacity = opacity * 0.5 * (0.8 + Math.sin(time * 0.5) * 0.2);
    }
  });

  return (
    <group>
      {/* 实体地板 - 使用 polygonOffset 避免 Z-fighting */}
      {showGround && (
        <mesh position={[0, groundY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[groundSize, 64]} />
          <meshStandardMaterial
            color={groundColor}
            roughness={0.8}
            metalness={0.2}
            polygonOffset={true}
            polygonOffsetFactor={1}
            polygonOffsetUnits={1}
          />
        </mesh>
      )}
      {/* 雾气效果 - 放在地板下方，使用更低的透明度 */}
      <mesh 
        ref={meshRef} 
        position={[0, fogY, 0]} 
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={-1}
      >
        <circleGeometry args={[groundSize * 1.3, 64]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={opacity * 0.4}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};
