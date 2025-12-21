import { useRef, useMemo, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import type { ShootingStarsConfig } from '../../types';

interface ShootingStar {
  id: number;
  startPos: THREE.Vector3;
  endPos: THREE.Vector3;
  progress: number;
  speed: number;
  trailPositions: THREE.Vector3[];
  size: number;
  brightness: number;
}

interface ShootingStarsProps {
  config: ShootingStarsConfig;
}

export const ShootingStars = ({ config }: ShootingStarsProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const [stars, setStars] = useState<ShootingStar[]>([]);
  const nextSpawnRef = useRef(0);
  const starIdRef = useRef(0);
  const timeRef = useRef(0);
  
  // 流星拖尾段数
  const trailSegments = 30;
  
  // 生成随机生成间隔（更频繁）
  const getRandomInterval = () => {
    const [min, max] = config.frequency;
    // 缩短间隔，让流星更频繁
    return (min + Math.random() * (max - min)) * 0.4;
  };
  
  // 生成新流星 - 在远处的星空中
  const spawnStar = (): ShootingStar => {
    // 随机选择流星出现的区域（天空的不同位置）
    const region = Math.random();
    
    let startX: number, startY: number, startZ: number;
    let endX: number, endY: number, endZ: number;
    
    if (region < 0.4) {
      // 左上方天空（最常见）
      startX = -200 - Math.random() * 100;
      startY = 150 + Math.random() * 100;
      startZ = -150 - Math.random() * 100;
      
      endX = startX + 180 + Math.random() * 80;
      endY = startY - 120 - Math.random() * 60;
      endZ = startZ + 60 + Math.random() * 40;
    } else if (region < 0.7) {
      // 右上方天空
      startX = 100 + Math.random() * 150;
      startY = 160 + Math.random() * 80;
      startZ = -180 - Math.random() * 80;
      
      endX = startX - 150 - Math.random() * 60;
      endY = startY - 130 - Math.random() * 50;
      endZ = startZ + 50 + Math.random() * 30;
    } else if (region < 0.85) {
      // 正上方天空
      startX = -50 + Math.random() * 100;
      startY = 200 + Math.random() * 80;
      startZ = -200 - Math.random() * 100;
      
      endX = startX + (Math.random() - 0.5) * 100;
      endY = startY - 150 - Math.random() * 50;
      endZ = startZ + 80 + Math.random() * 40;
    } else {
      // 后方天空（偶尔）
      startX = -100 + Math.random() * 200;
      startY = 140 + Math.random() * 100;
      startZ = -250 - Math.random() * 100;
      
      endX = startX + (Math.random() - 0.5) * 120;
      endY = startY - 100 - Math.random() * 60;
      endZ = startZ + 100 + Math.random() * 50;
    }
    
    const startPos = new THREE.Vector3(startX, startY, startZ);
    const endPos = new THREE.Vector3(endX, endY, endZ);
    
    // 初始化拖尾位置（全部在起点）
    const trailPositions = new Array(trailSegments).fill(null).map(() => startPos.clone());
    
    // 随机大小和亮度（有些流星更大更亮）
    const sizeRandom = Math.random();
    const size = sizeRandom < 0.7 ? 0.3 + Math.random() * 0.4 : 0.8 + Math.random() * 0.6;
    const brightness = sizeRandom < 0.7 ? 0.6 + Math.random() * 0.3 : 0.9 + Math.random() * 0.1;
    
    return {
      id: starIdRef.current++,
      startPos,
      endPos,
      progress: 0,
      speed: config.speed * (0.6 + Math.random() * 0.8),
      trailPositions,
      size,
      brightness
    };
  };
  
  // 初始化生成时间，并立即生成几颗流星
  useEffect(() => {
    nextSpawnRef.current = timeRef.current + getRandomInterval();
    // 初始时生成 1-2 颗流星
    const initialStars = [];
    const initialCount = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < initialCount; i++) {
      const star = spawnStar();
      star.progress = Math.random() * 0.3; // 随机初始进度
      initialStars.push(star);
    }
    setStars(initialStars);
  }, [config.frequency]);
  
  // 流星材质
  const starMaterial = useMemo(() => {
    return new THREE.PointsMaterial({
      color: config.color,
      size: 2,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
  }, [config.color]);
  
  // 拖尾材质
  const trailMaterial = useMemo(() => {
    return new THREE.LineBasicMaterial({
      color: config.color,
      transparent: true,
      opacity: 0.6 * config.glowIntensity,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
  }, [config.color, config.glowIntensity]);
  
  useFrame((_, delta) => {
    if (!config.enabled) return;
    
    timeRef.current += delta;
    
    // 检查是否需要生成新流星（可能同时生成多颗）
    if (timeRef.current >= nextSpawnRef.current) {
      // 有概率同时生成 1-3 颗流星（流星雨效果）
      const spawnCount = Math.random() < 0.3 ? (Math.random() < 0.5 ? 2 : 3) : 1;
      const newStars: ShootingStar[] = [];
      for (let i = 0; i < spawnCount; i++) {
        newStars.push(spawnStar());
      }
      setStars(prev => [...prev, ...newStars]);
      nextSpawnRef.current = timeRef.current + getRandomInterval();
    }
    
    // 更新现有流星
    setStars(prev => {
      return prev
        .map(star => {
          // 更新进度（速度更快）
          const newProgress = star.progress + delta * star.speed * 0.5;
          
          // 计算当前位置
          const currentPos = new THREE.Vector3().lerpVectors(
            star.startPos,
            star.endPos,
            Math.min(newProgress, 1)
          );
          
          // 更新拖尾位置（每个点跟随前一个点，拖尾更长）
          const newTrailPositions = [...star.trailPositions];
          for (let i = newTrailPositions.length - 1; i > 0; i--) {
            const lerpFactor = 0.15 * config.trailLength; // 更慢的跟随 = 更长的拖尾
            newTrailPositions[i] = newTrailPositions[i].clone().lerp(
              newTrailPositions[i - 1],
              lerpFactor
            );
          }
          newTrailPositions[0] = currentPos.clone();
          
          return {
            ...star,
            progress: newProgress,
            trailPositions: newTrailPositions
          };
        })
        .filter(star => star.progress < 1.3); // 移除完成的流星
    });
  });
  
  // 清理资源
  useEffect(() => {
    return () => {
      starMaterial.dispose();
      trailMaterial.dispose();
    };
  }, [starMaterial, trailMaterial]);

  if (!config.enabled) return null;

  return (
    <group ref={groupRef}>
      {stars.map(star => {
        // 计算当前位置
        const currentPos = new THREE.Vector3().lerpVectors(
          star.startPos,
          star.endPos,
          Math.min(star.progress, 1)
        );
        
        // 流星头部透明度（接近终点时渐隐）
        const headOpacity = star.progress > 0.7 
          ? 1 - (star.progress - 0.7) / 0.3 
          : 1;
        
        const finalOpacity = headOpacity * star.brightness;
        
        return (
          <group key={star.id}>
            {/* 流星头部 - 发光核心 */}
            <mesh position={currentPos}>
              <sphereGeometry args={[star.size * 0.8, 8, 8]} />
              <meshBasicMaterial 
                color={config.color}
                transparent
                opacity={finalOpacity * config.glowIntensity}
                blending={THREE.AdditiveBlending}
              />
            </mesh>
            
            {/* 流星头部光晕 - 更大更柔和 */}
            <mesh position={currentPos}>
              <sphereGeometry args={[star.size * 2.5, 8, 8]} />
              <meshBasicMaterial 
                color={config.color}
                transparent
                opacity={finalOpacity * 0.25 * config.glowIntensity}
                blending={THREE.AdditiveBlending}
              />
            </mesh>
            
            {/* 外层光晕 */}
            <mesh position={currentPos}>
              <sphereGeometry args={[star.size * 4, 8, 8]} />
              <meshBasicMaterial 
                color={config.color}
                transparent
                opacity={finalOpacity * 0.1 * config.glowIntensity}
                blending={THREE.AdditiveBlending}
              />
            </mesh>
            
            {/* 拖尾 - 使用 drei Line 组件 */}
            <Line
              points={star.trailPositions.map(p => [p.x, p.y, p.z] as [number, number, number])}
              color={config.color}
              lineWidth={Math.max(1, star.size * 3)}
              transparent
              opacity={0.6 * finalOpacity * config.glowIntensity}
            />
          </group>
        );
      })}
    </group>
  );
};
