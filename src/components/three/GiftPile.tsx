import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CONFIG } from '../../config';
import type { SceneState, AnimationEasing, ScatterShape, GatherShape } from '../../types';

// 缓动函数
const easingFunctions: Record<AnimationEasing, (t: number) => number> = {
  linear: (t) => t,
  easeIn: (t) => t * t * t,
  easeOut: (t) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  bounce: (t) => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) { t -= 1.5 / d1; return n1 * t * t + 0.75; }
    if (t < 2.5 / d1) { t -= 2.25 / d1; return n1 * t * t + 0.9375; }
    t -= 2.625 / d1; return n1 * t * t + 0.984375;
  },
  elastic: (t) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
  }
};

// 种子随机函数
const seededRandom = (seed: number) => {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// 根据散开形状和索引生成位置（确定性）
const generateScatterPosition = (shape: ScatterShape, index: number): THREE.Vector3 => {
  const r1 = seededRandom(index * 3 + 1);
  const r2 = seededRandom(index * 3 + 2);
  const r3 = seededRandom(index * 3 + 3);
  
  switch (shape) {
    case 'explosion': {
      const theta = r1 * Math.PI * 2;
      const phi = Math.acos(2 * r2 - 1);
      const r = 15 + r3 * 20;
      return new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta) - 5,
        r * Math.cos(phi)
      );
    }
    case 'spiral': {
      const t = r1;
      const angle = t * Math.PI * 8;
      const radius = 10 + t * 20 + r2 * 5;
      const y = -15 + t * 30 + (r3 - 0.5) * 8;
      return new THREE.Vector3(radius * Math.cos(angle), y, radius * Math.sin(angle));
    }
    case 'rain': {
      return new THREE.Vector3(
        (r1 - 0.5) * 45,
        20 + r2 * 25,
        (r3 - 0.5) * 45
      );
    }
    case 'ring': {
      const angle = r1 * Math.PI * 2;
      const radius = 18 + r2 * 8;
      const y = (r3 - 0.5) * 10 - 5;
      return new THREE.Vector3(radius * Math.cos(angle), y, radius * Math.sin(angle));
    }
    case 'sphere':
    default:
      return new THREE.Vector3(
        (r1 - 0.5) * 50,
        (r2 - 0.5) * 50,
        (r3 - 0.5) * 50
      );
  }
};

// 生成目标位置
const generateTargetPosition = (index: number): THREE.Vector3 => {
  const r1 = seededRandom(index * 4 + 100);
  const r2 = seededRandom(index * 4 + 101);
  const r3 = seededRandom(index * 4 + 102);
  const angle = r1 * Math.PI * 2;
  const radius = 2 + r2 * 6;
  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  const y = -CONFIG.tree.height / 2 - 1 + r3 * 1.5;
  return new THREE.Vector3(x, y, z);
};

// 根据聚合形状计算延迟（礼物堆在底部，使用简化版）
const calculateGatherDelay = (pos: THREE.Vector3, shape: GatherShape): number => {
  const normalizedX = (pos.x + 10) / 20;
  const dist = Math.sqrt(pos.x * pos.x + pos.z * pos.z) / 10;
  const angle = Math.atan2(pos.z, pos.x);
  
  switch (shape) {
    case 'stack': return 0; // 礼物堆本身就在底部
    case 'spiralIn': return ((angle + Math.PI) / (2 * Math.PI)) * 0.5;
    case 'implode': return (1 - dist) * 0.4;
    case 'waterfall': return 0.6; // 礼物堆最后落下
    case 'wave': return normalizedX * 0.5;
    case 'direct':
    default: return 0;
  }
};

interface GiftPileProps {
  state: SceneState;
  count?: number;
  easing?: AnimationEasing;
  speed?: number;
  scatterShape?: ScatterShape;
  gatherShape?: GatherShape;
}

export const GiftPile = ({ 
  state, 
  count = 18,
  easing = 'easeInOut',
  speed = 1,
  scatterShape = 'sphere',
  gatherShape = 'direct'
}: GiftPileProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const progressRef = useRef(0);
  
  // 存储当前动画中的 chaos 位置
  const currentChaosRef = useRef<THREE.Vector3[]>([]);
  const targetChaosRef = useRef<THREE.Vector3[]>([]);
  const chaosTransitionRef = useRef(1);
  const prevScatterShapeRef = useRef(scatterShape);

  const gifts = useMemo(() => {
    const items: {
      pos: THREE.Vector3;
      scale: number;
      color: string;
      rotation: THREE.Euler;
      gatherDelay: number;
    }[] = [];
    const colors = CONFIG.colors.giftColors;

    for (let i = 0; i < count; i++) {
      const pos = generateTargetPosition(i);
      const r1 = seededRandom(i * 3 + 200);
      const r2 = seededRandom(i * 3 + 201);
      const r3 = seededRandom(i * 3 + 202);

      items.push({
        pos,
        scale: 0.8 + r1 * 1.2,
        color: colors[Math.floor(r2 * colors.length)],
        rotation: new THREE.Euler(0, r3 * Math.PI, 0),
        gatherDelay: calculateGatherDelay(pos, gatherShape)
      });
    }
    return items;
  }, [count, gatherShape]);

  // 初始化 chaos 位置
  useEffect(() => {
    if (currentChaosRef.current.length !== count) {
      currentChaosRef.current = gifts.map((_, i) => generateScatterPosition(scatterShape, i));
      targetChaosRef.current = currentChaosRef.current.map(p => p.clone());
      chaosTransitionRef.current = 1;
    }
  }, [count, gifts, scatterShape]);

  // 当 scatterShape 改变时，设置新的目标 chaos 位置
  useEffect(() => {
    if (prevScatterShapeRef.current !== scatterShape) {
      currentChaosRef.current = currentChaosRef.current.map((pos, i) => {
        const newPos = pos.clone();
        if (chaosTransitionRef.current < 1) {
          newPos.lerp(targetChaosRef.current[i], chaosTransitionRef.current);
        }
        return newPos;
      });
      targetChaosRef.current = gifts.map((_, i) => generateScatterPosition(scatterShape, i));
      chaosTransitionRef.current = 0;
      prevScatterShapeRef.current = scatterShape;
    }
  }, [scatterShape, gifts]);

  // 动画持续时间（秒），speed 越大越快
  const duration = 1 / Math.max(0.3, Math.min(3, speed));
  const easeFn = easingFunctions[easing] || easingFunctions.easeInOut;

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const isFormed = state === 'FORMED';
    const targetProgress = isFormed ? 1 : 0;
    
    // 线性插值进度，基于持续时间
    const step = delta / duration;
    if (targetProgress > progressRef.current) {
      progressRef.current = Math.min(targetProgress, progressRef.current + step);
    } else if (targetProgress < progressRef.current) {
      progressRef.current = Math.max(targetProgress, progressRef.current - step);
    }
    const rawT = progressRef.current;
    
    // 更新 chaos 位置过渡
    if (chaosTransitionRef.current < 1) {
      chaosTransitionRef.current = Math.min(1, chaosTransitionRef.current + step);
    }
    
    groupRef.current.children.forEach((child, i) => {
      const gift = gifts[i];
      
      // 计算当前的 chaos 位置
      const currentChaos = currentChaosRef.current[i];
      const targetChaos = targetChaosRef.current[i];
      const chaosT = easeFn(chaosTransitionRef.current);
      const animatedChaosPos = currentChaos.clone().lerp(targetChaos, chaosT);
      
      // 统一使用基于延迟的进度计算，确保打断时位置连续
      const delay = gift.gatherDelay;
      let elementT: number;
      if (delay === 0) {
        elementT = easeFn(rawT);
      } else {
        const adjustedT = Math.max(0, Math.min(1, (rawT - delay * 0.5) / (1 - delay * 0.5)));
        elementT = easeFn(adjustedT);
      }
      
      // 使用缓动函数插值位置
      child.position.lerpVectors(animatedChaosPos, gift.pos, elementT);
    });
  });

  // 获取初始位置
  const getInitialPosition = (index: number) => {
    if (currentChaosRef.current[index]) {
      return currentChaosRef.current[index].clone();
    }
    return generateScatterPosition(scatterShape, index);
  };

  return (
    <group ref={groupRef}>
      {gifts.map((gift, i) => (
        <group key={i} position={getInitialPosition(i)} rotation={gift.rotation} scale={gift.scale}>
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
