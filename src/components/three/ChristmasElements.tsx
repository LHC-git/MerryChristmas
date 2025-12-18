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

// 根据索引和形状生成确定性的散开位置（使用种子随机）
const seededRandom = (seed: number) => {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// 根据散开形状和索引生成位置（确定性，同一索引同一形状总是相同位置）
const generateScatterPosition = (shape: ScatterShape, index: number): THREE.Vector3 => {
  const r1 = seededRandom(index * 3 + 1);
  const r2 = seededRandom(index * 3 + 2);
  const r3 = seededRandom(index * 3 + 3);
  
  switch (shape) {
    case 'explosion': {
      const theta = r1 * Math.PI * 2;
      const phi = Math.acos(2 * r2 - 1);
      const r = 20 + r3 * 25;
      return new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      );
    }
    case 'spiral': {
      const t = r1;
      const angle = t * Math.PI * 12;
      const radius = 8 + t * 25 + r2 * 5;
      const y = -20 + t * 50 + (r3 - 0.5) * 8;
      return new THREE.Vector3(radius * Math.cos(angle), y, radius * Math.sin(angle));
    }
    case 'rain': {
      return new THREE.Vector3(
        (r1 - 0.5) * 60,
        25 + r2 * 35,
        (r3 - 0.5) * 60
      );
    }
    case 'ring': {
      const angle = r1 * Math.PI * 2;
      const radius = 22 + r2 * 10;
      const y = (r3 - 0.5) * 15;
      return new THREE.Vector3(radius * Math.cos(angle), y, radius * Math.sin(angle));
    }
    case 'sphere':
    default:
      return new THREE.Vector3(
        (r1 - 0.5) * 60,
        (r2 - 0.5) * 60,
        (r3 - 0.5) * 60
      );
  }
};

// 生成目标位置（树上的位置）
const generateTargetPosition = (index: number): THREE.Vector3 => {
  const r1 = seededRandom(index * 7 + 100);
  const r2 = seededRandom(index * 7 + 101);
  const h = CONFIG.tree.height;
  const y = (r1 * h) - (h / 2);
  const rBase = CONFIG.tree.radius;
  const currentRadius = (rBase * (1 - (y + (h / 2)) / h)) * 0.95;
  const theta = r2 * Math.PI * 2;
  return new THREE.Vector3(currentRadius * Math.cos(theta), y, currentRadius * Math.sin(theta));
};

// 根据聚合形状计算延迟
const calculateGatherDelay = (targetPos: THREE.Vector3, shape: GatherShape): number => {
  const normalizedY = (targetPos.y + CONFIG.tree.height / 2) / CONFIG.tree.height;
  const normalizedX = (targetPos.x + CONFIG.tree.radius) / (2 * CONFIG.tree.radius);
  const dist = Math.sqrt(targetPos.x * targetPos.x + targetPos.z * targetPos.z) / CONFIG.tree.radius;
  const angle = Math.atan2(targetPos.z, targetPos.x);
  
  switch (shape) {
    case 'stack': return normalizedY * 0.7;
    case 'spiralIn': return ((angle + Math.PI) / (2 * Math.PI) + normalizedY * 0.5) * 0.5;
    case 'implode': return (1 - dist) * 0.5;
    case 'waterfall': return (1 - normalizedY) * 0.7;
    case 'wave': return normalizedX * 0.6;
    case 'direct':
    default: return 0;
  }
};

interface ChristmasElementsProps {
  state: SceneState;
  customImages?: {
    box?: string;
    sphere?: string;
    cylinder?: string;
  };
  easing?: AnimationEasing;
  speed?: number;
  scatterShape?: ScatterShape;
  gatherShape?: GatherShape;
}



export const ChristmasElements = ({ 
  state, 
  customImages, 
  easing = 'easeInOut', 
  speed = 1,
  scatterShape = 'sphere',
  gatherShape = 'direct'
}: ChristmasElementsProps) => {
  const count = CONFIG.counts.elements;
  const groupRef = useRef<THREE.Group>(null);
  const progressRef = useRef(0);
  
  // 存储当前动画中的 chaos 位置（用于平滑过渡散开形状）
  const currentChaosRef = useRef<THREE.Vector3[]>([]);
  const targetChaosRef = useRef<THREE.Vector3[]>([]);
  const chaosTransitionRef = useRef(1); // 0-1，chaos 位置过渡进度
  const prevScatterShapeRef = useRef(scatterShape);

  // 加载自定义图片纹理
  const textures = useMemo(() => {
    const result: { box?: THREE.Texture; sphere?: THREE.Texture; cylinder?: THREE.Texture } = {};
    
    if (customImages?.box) {
      const tex = new THREE.TextureLoader().load(customImages.box);
      tex.colorSpace = THREE.SRGBColorSpace;
      result.box = tex;
    }
    if (customImages?.sphere) {
      const tex = new THREE.TextureLoader().load(customImages.sphere);
      tex.colorSpace = THREE.SRGBColorSpace;
      result.sphere = tex;
    }
    if (customImages?.cylinder) {
      const tex = new THREE.TextureLoader().load(customImages.cylinder);
      tex.colorSpace = THREE.SRGBColorSpace;
      result.cylinder = tex;
    }
    
    return result;
  }, [customImages?.box, customImages?.sphere, customImages?.cylinder]);

  const boxGeometry = useMemo(() => new THREE.BoxGeometry(0.8, 0.8, 0.8), []);
  const sphereGeometry = useMemo(() => new THREE.SphereGeometry(0.5, 16, 16), []);
  const caneGeometry = useMemo(() => new THREE.CylinderGeometry(0.15, 0.15, 1.2, 8), []);

  // 基础数据（不依赖 scatterShape，只在 count 或 gatherShape 变化时重新生成）
  const data = useMemo(() => {
    return new Array(count).fill(0).map((_, i) => {
      const targetPos = generateTargetPosition(i);
      const gatherDelay = calculateGatherDelay(targetPos, gatherShape);

      const r1 = seededRandom(i * 5 + 200);
      const r2 = seededRandom(i * 5 + 201);
      const r3 = seededRandom(i * 5 + 202);
      const r4 = seededRandom(i * 5 + 203);
      const r5 = seededRandom(i * 5 + 204);

      const type = Math.floor(r1 * 3); // 0=box, 1=sphere, 2=cylinder
      let color;
      let scale = 1;
      if (type === 0) {
        color = CONFIG.colors.giftColors[Math.floor(r2 * CONFIG.colors.giftColors.length)];
        scale = 0.8 + r3 * 0.4;
      } else if (type === 1) {
        color = CONFIG.colors.giftColors[Math.floor(r2 * CONFIG.colors.giftColors.length)];
        scale = 0.6 + r3 * 0.4;
      } else {
        color = r2 > 0.5 ? CONFIG.colors.red : CONFIG.colors.white;
        scale = 0.7 + r3 * 0.3;
      }

      const rotationSpeed = {
        x: (r3 - 0.5) * 2.0,
        y: (r4 - 0.5) * 2.0,
        z: (r5 - 0.5) * 2.0
      };
      return {
        type,
        targetPos,
        color,
        scale,
        gatherDelay,
        chaosRotation: new THREE.Euler(r3 * Math.PI, r4 * Math.PI, r5 * Math.PI),
        rotationSpeed
      };
    });
  }, [count, gatherShape]);

  // 初始化 chaos 位置
  useEffect(() => {
    if (currentChaosRef.current.length !== count) {
      currentChaosRef.current = data.map((_, i) => generateScatterPosition(scatterShape, i));
      targetChaosRef.current = currentChaosRef.current.map(p => p.clone());
      chaosTransitionRef.current = 1;
    }
  }, [count, data, scatterShape]);

  // 当 scatterShape 改变时，设置新的目标 chaos 位置
  useEffect(() => {
    if (prevScatterShapeRef.current !== scatterShape) {
      // 将当前位置保存为起点
      currentChaosRef.current = currentChaosRef.current.map((pos, i) => {
        const newPos = pos.clone();
        // 如果正在过渡中，使用插值后的位置
        if (chaosTransitionRef.current < 1) {
          newPos.lerp(targetChaosRef.current[i], chaosTransitionRef.current);
        }
        return newPos;
      });
      // 设置新的目标位置
      targetChaosRef.current = data.map((_, i) => generateScatterPosition(scatterShape, i));
      chaosTransitionRef.current = 0;
      prevScatterShapeRef.current = scatterShape;
    }
  }, [scatterShape, data]);

  // 动画持续时间（秒），speed 越大越快：0.3x -> 3.3秒, 1x -> 1秒, 3x -> 0.33秒
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
    
    // 更新 chaos 位置过渡（散开形状切换时的平滑过渡）
    if (chaosTransitionRef.current < 1) {
      chaosTransitionRef.current = Math.min(1, chaosTransitionRef.current + step);
    }
    
    groupRef.current.children.forEach((child, i) => {
      const objData = data[i];
      
      // 计算当前的 chaos 位置（考虑散开形状切换的过渡）
      const currentChaos = currentChaosRef.current[i];
      const targetChaos = targetChaosRef.current[i];
      const chaosT = easeFn(chaosTransitionRef.current);
      const animatedChaosPos = currentChaos.clone().lerp(targetChaos, chaosT);
      
      // 统一使用基于延迟的进度计算，确保打断时位置连续
      const delay = objData.gatherDelay;
      let elementT: number;
      if (delay === 0) {
        elementT = easeFn(rawT);
      } else {
        const adjustedT = Math.max(0, Math.min(1, (rawT - delay * 0.5) / (1 - delay * 0.5)));
        elementT = easeFn(adjustedT);
      }
      
      // 使用缓动函数插值位置（从动画中的 chaos 位置到目标位置）
      child.position.lerpVectors(animatedChaosPos, objData.targetPos, elementT);
      
      // 如果是精灵（图片），让它面向相机
      if (child instanceof THREE.Sprite) {
        // Sprite 自动面向相机
      } else {
        // 普通 mesh 继续旋转
        child.rotation.x += delta * objData.rotationSpeed.x * 0.5;
        child.rotation.y += delta * objData.rotationSpeed.y * 0.5;
        child.rotation.z += delta * objData.rotationSpeed.z * 0.5;
      }
    });
  });

  // 判断某个类型是否使用自定义图片
  const useCustomImage = (type: number) => {
    if (type === 0 && textures.box) return true;
    if (type === 1 && textures.sphere) return true;
    if (type === 2 && textures.cylinder) return true;
    return false;
  };

  const getTexture = (type: number) => {
    if (type === 0) return textures.box;
    if (type === 1) return textures.sphere;
    return textures.cylinder;
  };

  // 获取初始位置（用于渲染）
  const getInitialPosition = (index: number) => {
    if (currentChaosRef.current[index]) {
      return currentChaosRef.current[index].clone();
    }
    return generateScatterPosition(scatterShape, index);
  };

  return (
    <group ref={groupRef}>
      {data.map((obj, i) => {
        const initialPos = getInitialPosition(i);
        
        // 使用自定义图片
        if (useCustomImage(obj.type)) {
          const texture = getTexture(obj.type);
          return (
            <sprite 
              key={i} 
              position={initialPos}
              scale={[obj.scale * 1.5, obj.scale * 1.5, 1]}
            >
              <spriteMaterial 
                map={texture} 
                transparent 
                depthWrite={false}
                opacity={0.95}
              />
            </sprite>
          );
        }
        
        // 使用默认几何体
        let geometry;
        if (obj.type === 0) geometry = boxGeometry;
        else if (obj.type === 1) geometry = sphereGeometry;
        else geometry = caneGeometry;
        
        return (
          <mesh 
            key={i} 
            position={initialPos}
            scale={[obj.scale, obj.scale, obj.scale]} 
            geometry={geometry} 
            rotation={obj.chaosRotation}
          >
            <meshStandardMaterial color={obj.color} roughness={0.3} metalness={0.4} emissive={obj.color} emissiveIntensity={0.2} />
          </mesh>
        );
      })}
    </group>
  );
};
