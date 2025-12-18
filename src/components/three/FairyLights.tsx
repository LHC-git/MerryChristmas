import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CONFIG } from '../../config';
import type { SceneState } from '../../types';

interface FairyLightsProps {
  state: SceneState;
}

export const FairyLights = ({ state }: FairyLightsProps) => {
  const count = CONFIG.counts.lights;
  const groupRef = useRef<THREE.Group>(null);
  const geometry = useMemo(() => new THREE.SphereGeometry(0.8, 8, 8), []);

  const data = useMemo(() => {
    return new Array(count).fill(0).map(() => {
      const chaosPos = new THREE.Vector3(
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 60
      );
      const h = CONFIG.tree.height;
      const y = (Math.random() * h) - (h / 2);
      const rBase = CONFIG.tree.radius;
      const currentRadius = (rBase * (1 - (y + (h / 2)) / h)) + 0.3;
      const theta = Math.random() * Math.PI * 2;
      const targetPos = new THREE.Vector3(
        currentRadius * Math.cos(theta),
        y,
        currentRadius * Math.sin(theta)
      );
      const color = CONFIG.colors.lights[Math.floor(Math.random() * CONFIG.colors.lights.length)];
      const speed = 2 + Math.random() * 3;
      return { chaosPos, targetPos, color, speed, currentPos: chaosPos.clone(), timeOffset: Math.random() * 100 };
    });
  }, [count]);

  useFrame((stateObj, delta) => {
    if (!groupRef.current) return;
    const isFormed = state === 'FORMED';
    const time = stateObj.clock.elapsedTime;
    
    groupRef.current.children.forEach((child, i) => {
      const objData = data[i];
      const target = isFormed ? objData.targetPos : objData.chaosPos;
      objData.currentPos.lerp(target, delta * 1.2);
      const mesh = child as THREE.Mesh;
      mesh.position.copy(objData.currentPos);
      const intensity = (Math.sin(time * objData.speed + objData.timeOffset) + 1) / 2;
      if (mesh.material) {
        (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = isFormed ? 1 + intensity * 1.5 : 0.5 + intensity * 0.8;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {data.map((obj, i) => (
        <mesh key={i} position={obj.currentPos} scale={[0.15, 0.15, 0.15]} geometry={geometry}>
          <meshStandardMaterial color={obj.color} emissive={obj.color} emissiveIntensity={0} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
};
