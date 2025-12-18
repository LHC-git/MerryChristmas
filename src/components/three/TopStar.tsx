import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';
import { MathUtils } from 'three';
import { CONFIG } from '../../config';
import type { SceneState } from '../../types';

interface TopStarProps {
  state: SceneState;
}

export const TopStar = ({ state }: TopStarProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const pointLightRef = useRef<THREE.PointLight>(null);

  const starShape = useMemo(() => {
    const shape = new THREE.Shape();
    const outerRadius = 1.3;
    const innerRadius = 0.7;
    const points = 5;
    for (let i = 0; i < points * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
      if (i === 0) {
        shape.moveTo(radius * Math.cos(angle), radius * Math.sin(angle));
      } else {
        shape.lineTo(radius * Math.cos(angle), radius * Math.sin(angle));
      }
    }
    shape.closePath();
    return shape;
  }, []);

  const starGeometry = useMemo(() => {
    return new THREE.ExtrudeGeometry(starShape, {
      depth: 0.4,
      bevelEnabled: true,
      bevelThickness: 0.1,
      bevelSize: 0.1,
      bevelSegments: 3,
    });
  }, [starShape]);

  useFrame((frameState, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.5;
      const targetScale = state === 'FORMED' ? 1 : 0.01;
      const currentScale = groupRef.current.scale.x;
      const newScale = MathUtils.lerp(currentScale, targetScale, delta * 1.5);
      groupRef.current.scale.setScalar(Math.max(0.01, newScale));
    }

    // 动态发光脉冲
    const time = frameState.clock.elapsedTime;
    const pulse = 0.6 + Math.sin(time * 2) * 0.4;

    if (materialRef.current) {
      materialRef.current.emissiveIntensity = 1.5 + pulse;
    }

    if (pointLightRef.current) {
      pointLightRef.current.intensity = 80 + pulse * 40;
    }
  });

  return (
    <group ref={groupRef} position={[0, CONFIG.tree.height / 2 + 1.8, 0]}>
      <Float speed={2} rotationIntensity={0.2} floatIntensity={0.2}>
        {/* 五角星 - 高发光强度配合 Bloom 产生光晕 */}
        <mesh geometry={starGeometry}>
          <meshStandardMaterial
            ref={materialRef}
            color={CONFIG.colors.gold}
            emissive={CONFIG.colors.gold}
            emissiveIntensity={2}
            roughness={0.1}
            metalness={0.9}
          />
        </mesh>

        {/* 点光源照亮周围 */}
        <pointLight
          ref={pointLightRef}
          color="#FFD700"
          intensity={100}
          distance={20}
          decay={2}
        />
      </Float>
    </group>
  );
};
