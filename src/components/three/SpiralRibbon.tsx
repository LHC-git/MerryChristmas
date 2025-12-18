import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MathUtils } from 'three';
import { CONFIG } from '../../config';
import type { SceneState } from '../../types';

interface SpiralRibbonProps {
  state: SceneState;
  color?: string;
  glowColor?: string;
}

export const SpiralRibbon = ({ 
  state, 
  color = '#FF4444',
  glowColor = '#FF6666'
}: SpiralRibbonProps) => {
  const ribbonRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  const progressRef = useRef(0);

  // 创建螺旋丝带几何体
  const ribbonGeometry = useMemo(() => {
    const treeHeight = CONFIG.tree.height;
    const baseRadius = CONFIG.tree.radius;
    
    // 丝带参数
    const turns = 5; // 缠绕圈数
    const ribbonWidth = 0.8;
    const ribbonThickness = 0.1;
    const segments = 200;
    
    const shape = new THREE.Shape();
    shape.moveTo(0, -ribbonWidth / 2);
    shape.lineTo(ribbonThickness, -ribbonWidth / 2);
    shape.lineTo(ribbonThickness, ribbonWidth / 2);
    shape.lineTo(0, ribbonWidth / 2);
    shape.closePath();

    // 创建螺旋路径
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = t * Math.PI * 2 * turns;
      const y = t * treeHeight - treeHeight / 2 + 1;
      
      // 圣诞树是锥形，半径随高度减小
      const radiusAtHeight = baseRadius * (1 - t * 0.85) + 1;
      
      const x = Math.cos(angle) * radiusAtHeight;
      const z = Math.sin(angle) * radiusAtHeight;
      
      points.push(new THREE.Vector3(x, y, z));
    }

    const curve = new THREE.CatmullRomCurve3(points);
    
    const extrudeSettings = {
      steps: segments,
      bevelEnabled: false,
      extrudePath: curve,
    };

    return new THREE.ExtrudeGeometry(shape, extrudeSettings);
  }, []);

  useFrame((frameState, delta) => {
    // 动画进度
    const targetProgress = state === 'FORMED' ? 1 : 0;
    progressRef.current = MathUtils.lerp(progressRef.current, targetProgress, delta * 2);

    if (ribbonRef.current) {
      ribbonRef.current.scale.setScalar(Math.max(0.01, progressRef.current));
    }

    // 发光脉冲
    if (materialRef.current) {
      const time = frameState.clock.elapsedTime;
      const pulse = 0.8 + Math.sin(time * 3) * 0.2;
      materialRef.current.emissiveIntensity = pulse * progressRef.current;
    }
  });

  return (
    <mesh ref={ribbonRef} geometry={ribbonGeometry}>
      <meshStandardMaterial
        ref={materialRef}
        color={color}
        emissive={glowColor}
        emissiveIntensity={0.8}
        roughness={0.3}
        metalness={0.5}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
};
