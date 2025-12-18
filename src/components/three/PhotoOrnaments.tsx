import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { MathUtils } from 'three';
import { CONFIG } from '../../config';
import type { SceneState, PhotoScreenPosition } from '../../types';

// 全局变量存储照片位置，用于捏合选择
export let photoScreenPositions: PhotoScreenPosition[] = [];

interface PhotoOrnamentsProps {
  state: SceneState;
  selectedIndex: number | null;
  onPhotoClick?: (index: number | null) => void;
  photoPaths: string[];
}

export const PhotoOrnaments = ({ state, selectedIndex, onPhotoClick, photoPaths }: PhotoOrnamentsProps) => {
  const textures = useTexture(photoPaths);
  const count = photoPaths.length;
  const groupRef = useRef<THREE.Group>(null);

  useMemo(() => {
    textures.forEach((texture: THREE.Texture) => {
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      texture.needsUpdate = true;
    });
  }, [textures]);

  const borderGeometry = useMemo(() => new THREE.PlaneGeometry(1.2, 1.5), []);
  const photoGeometry = useMemo(() => new THREE.PlaneGeometry(1, 1), []);

  const data = useMemo(() => {
    return new Array(count).fill(0).map((_, i) => {
      const chaosPos = new THREE.Vector3((Math.random() - 0.5) * 70, (Math.random() - 0.5) * 70, (Math.random() - 0.5) * 70);
      const h = CONFIG.tree.height;
      const y = (Math.random() * h) - (h / 2);
      const rBase = CONFIG.tree.radius;
      const currentRadius = (rBase * (1 - (y + (h / 2)) / h)) + 0.5;
      const theta = Math.random() * Math.PI * 2;
      const targetPos = new THREE.Vector3(currentRadius * Math.cos(theta), y, currentRadius * Math.sin(theta));

      const isBig = Math.random() < 0.2;
      const baseScale = isBig ? 2.2 : 0.8 + Math.random() * 0.6;
      const weight = 0.8 + Math.random() * 1.2;
      const borderColor = CONFIG.colors.borders[Math.floor(Math.random() * CONFIG.colors.borders.length)];

      return {
        chaosPos,
        targetPos,
        scale: baseScale,
        weight,
        textureIndex: i % textures.length,
        borderColor,
        currentPos: chaosPos.clone(),
        currentScale: baseScale,
        chaosRotation: new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI),
        rotationSpeed: { x: (Math.random() - 0.5) * 1.0, y: (Math.random() - 0.5) * 1.0, z: (Math.random() - 0.5) * 1.0 },
        wobbleOffset: Math.random() * 10,
        wobbleSpeed: 0.5 + Math.random() * 0.5
      };
    });
  }, [textures, count]);

  useFrame((stateObj, delta) => {
    if (!groupRef.current) return;
    const isFormed = state === 'FORMED';
    const time = stateObj.clock.elapsedTime;
    const camera = stateObj.camera;

    groupRef.current.children.forEach((group, i) => {
      const objData = data[i];
      const isSelected = selectedIndex === i;

      let target: THREE.Vector3;
      let targetScale: number;

      if (isSelected) {
        // 图片移动到相机正前方
        const cameraDir = new THREE.Vector3();
        camera.getWorldDirection(cameraDir);
        target = camera.position.clone().add(cameraDir.multiplyScalar(25));
        targetScale = 15;
      } else if (isFormed) {
        target = objData.targetPos;
        targetScale = objData.scale;
      } else {
        target = objData.chaosPos;
        targetScale = objData.scale;
      }

      const lerpSpeed = isSelected ? 8 : (isFormed ? 2 * objData.weight : 1.5);
      objData.currentPos.lerp(target, delta * lerpSpeed);
      group.position.copy(objData.currentPos);

      if (!isSelected && objData.currentPos.distanceTo(target) > 0.1) {
        objData.currentPos.lerp(target, delta * lerpSpeed * 1.5);
      }

      if (!isSelected) {
        const screenPos = objData.currentPos.clone().project(camera);
        const screenX = (1 - screenPos.x) / 2;
        const screenY = (1 - screenPos.y) / 2;
        if (screenPos.z < 1 && screenX >= 0 && screenX <= 1 && screenY >= 0 && screenY <= 1) {
          photoScreenPositions[i] = { index: i, x: screenX, y: screenY };
        }
      }

      objData.currentScale = MathUtils.lerp(objData.currentScale, targetScale, delta * 3);
      group.scale.setScalar(objData.currentScale);

      if (isSelected) {
        group.lookAt(camera.position);
        group.rotation.y += Math.sin(time * 2) * 0.03;
      } else if (isFormed) {
        const targetLookPos = new THREE.Vector3(group.position.x * 2, group.position.y + 0.5, group.position.z * 2);
        group.lookAt(targetLookPos);
        group.rotation.x += Math.sin(time * objData.wobbleSpeed + objData.wobbleOffset) * 0.05;
        group.rotation.z += Math.cos(time * objData.wobbleSpeed * 0.8 + objData.wobbleOffset) * 0.05;
      } else {
        group.rotation.x += delta * objData.rotationSpeed.x;
        group.rotation.y += delta * objData.rotationSpeed.y;
        group.rotation.z += delta * objData.rotationSpeed.z;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {data.map((obj, i) => (
        <group
          key={i}
          scale={[obj.scale, obj.scale, obj.scale]}
          rotation={state === 'CHAOS' ? obj.chaosRotation : [0, 0, 0]}
          onClick={() => onPhotoClick?.(selectedIndex === i ? null : i)}
        >
          <group position={[0, 0, 0.015]}>
            <mesh geometry={photoGeometry}>
              <meshBasicMaterial
                map={textures[obj.textureIndex]}
                side={THREE.FrontSide}
                toneMapped={false}
              />
            </mesh>
            <mesh geometry={borderGeometry} position={[0, -0.15, -0.01]}>
              <meshStandardMaterial
                color="#FFFFFF"
                emissive="#FFFFFF"
                emissiveIntensity={1.2}
                roughness={0.3}
                metalness={0}
                side={THREE.FrontSide}
              />
            </mesh>
          </group>
          <group position={[0, 0, -0.015]} rotation={[0, Math.PI, 0]}>
            <mesh geometry={photoGeometry}>
              <meshBasicMaterial
                map={textures[obj.textureIndex]}
                side={THREE.FrontSide}
                toneMapped={false}
              />
            </mesh>
            <mesh geometry={borderGeometry} position={[0, -0.15, -0.01]}>
              <meshStandardMaterial
                color="#FFFFFF"
                emissive="#FFFFFF"
                emissiveIntensity={1.2}
                roughness={0.3}
                metalness={0}
                side={THREE.FrontSide}
              />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
};
