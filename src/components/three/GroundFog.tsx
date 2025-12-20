import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CONFIG } from '../../config';

interface GroundFogProps {
  opacity?: number;
  color?: string;
  treeHeight?: number;
  treeRadius?: number;
  count?: number;      // 粒子数量
  size?: number;       // 粒子大小
  spread?: number;     // 范围倍数
  height?: number;     // 高度范围
}

export const GroundFog = ({ 
  opacity = 0.3, 
  color = '#ffffff',
  treeHeight,
  treeRadius,
  count = 800,
  size = 0.8,
  spread = 1,
  height = 1.5
}: GroundFogProps) => {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);
  
  const actualHeight = treeHeight ?? CONFIG.tree.height;
  const actualRadius = treeRadius ?? CONFIG.tree.radius;
  const groundSize = actualRadius * 1.8 * spread;
  
  // 地板位置
  const groundY = -actualHeight / 2 - 3.5;
  
  // 生成粒子位置和随机值
  const { positions, randoms, baseY } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const rnd = new Float32Array(count);
    const baseYArr = new Float32Array(count);
    
    for (let i = 0; i < count; i++) {
      // 在圆形区域内随机分布
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * groundSize * 1.2;
      
      pos[i * 3] = Math.cos(angle) * radius;
      // 粒子只在地板下方，不往上飘
      const yOffset = Math.random() * height * 0.5;
      pos[i * 3 + 1] = groundY - yOffset;
      pos[i * 3 + 2] = Math.sin(angle) * radius;
      
      rnd[i] = Math.random();
      baseYArr[i] = groundY - yOffset;
    }
    
    return { positions: pos, randoms: rnd, baseY: baseYArr };
  }, [groundSize, groundY, count, height]);

  useFrame((state) => {
    if (!pointsRef.current) return;
    
    const time = state.clock.elapsedTime;
    const posAttr = pointsRef.current.geometry.attributes.position;
    const posArray = posAttr.array as Float32Array;
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const rnd = randoms[i];
      
      // 缓慢的水平漂移
      posArray[i3] += Math.sin(time * 0.3 + rnd * 10) * 0.002;
      posArray[i3 + 2] += Math.cos(time * 0.3 + rnd * 10) * 0.002;
      
      // 垂直浮动 - 只在地板下方小范围浮动
      posArray[i3 + 1] = baseY[i] + Math.sin(time * 0.5 + rnd * 6) * 0.3;
      
      // 边界检查，超出范围则重置
      const dist = Math.sqrt(posArray[i3] ** 2 + posArray[i3 + 2] ** 2);
      if (dist > groundSize * 1.3) {
        const angle = Math.random() * Math.PI * 2;
        const newRadius = Math.sqrt(Math.random()) * groundSize * 0.5;
        posArray[i3] = Math.cos(angle) * newRadius;
        posArray[i3 + 2] = Math.sin(angle) * newRadius;
      }
    }
    
    posAttr.needsUpdate = true;
    
    // 整体透明度呼吸效果
    if (materialRef.current) {
      materialRef.current.opacity = opacity * (0.6 + Math.sin(time * 0.3) * 0.2);
    }
  });

  return (
    <group>
      {/* 雾气粒子效果 - renderOrder 设为负数确保在其他物体后面渲染 */}
      <points ref={pointsRef} renderOrder={-10}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[positions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          ref={materialRef}
          color={color}
          size={size}
          transparent
          opacity={opacity * 0.6}
          depthWrite={false}
          depthTest={true}
          sizeAttenuation
        />
      </points>
    </group>
  );
};
