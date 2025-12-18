import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CONFIG } from '../../config';
import type { SceneState } from '../../types';

interface GiftPileProps {
  state: SceneState;
  count?: number;
}

export const GiftPile = ({ state, count = 18 }: GiftPileProps) => {
  const groupRef = useRef<THREE.Group>(null);

  const gifts = useMemo(() => {
    const items: {
      pos: THREE.Vector3;
      chaosPos: THREE.Vector3;
      scale: number;
      color: string;
      rotation: THREE.Euler;
    }[] = [];
    const colors = CONFIG.colors.giftColors;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 2 + Math.random() * 6;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = -CONFIG.tree.height / 2 - 1 + Math.random() * 1.5;

      items.push({
        pos: new THREE.Vector3(x, y, z),
        chaosPos: new THREE.Vector3(
          (Math.random() - 0.5) * 50,
          (Math.random() - 0.5) * 50,
          (Math.random() - 0.5) * 50
        ),
        scale: 0.8 + Math.random() * 1.2,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: new THREE.Euler(0, Math.random() * Math.PI, 0)
      });
    }
    return items;
  }, [count]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const isFormed = state === 'FORMED';
    groupRef.current.children.forEach((child, i) => {
      const gift = gifts[i];
      const target = isFormed ? gift.pos : gift.chaosPos;
      child.position.lerp(target, delta * 1.5);
    });
  });

  return (
    <group ref={groupRef}>
      {gifts.map((gift, i) => (
        <group key={i} position={gift.chaosPos} rotation={gift.rotation} scale={gift.scale}>
          <mesh>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color={gift.color} roughness={0.3} metalness={0.2} />
          </mesh>
          <mesh position={[0, 0, 0.01]}>
            <boxGeometry args={[0.15, 1.02, 1.02]} />
            <meshStandardMaterial color={CONFIG.colors.gold} roughness={0.2} metalness={0.6} emissive={CONFIG.colors.gold} emissiveIntensity={0.3} />
          </mesh>
          <mesh position={[0, 0.01, 0]}>
            <boxGeometry args={[1.02, 0.15, 1.02]} />
            <meshStandardMaterial color={CONFIG.colors.gold} roughness={0.2} metalness={0.6} emissive={CONFIG.colors.gold} emissiveIntensity={0.3} />
          </mesh>
          <mesh position={[0, 0.6, 0]}>
            <sphereGeometry args={[0.15, 8, 8]} />
            <meshStandardMaterial color={CONFIG.colors.gold} roughness={0.2} metalness={0.6} emissive={CONFIG.colors.gold} emissiveIntensity={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
};
