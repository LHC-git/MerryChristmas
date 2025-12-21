import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CONFIG } from '../../config';
import type { BellConfig, SceneState } from '../../types';

// 种子随机函数（确保相同索引生成相同位置）
const seededRandom = (seed: number) => {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// 生成铃铛在圣诞树上的位置（聚合状态）
const generateBellPosition = (
  index: number, 
  treeHeight: number, 
  treeRadius: number
): THREE.Vector3 => {
  const r1 = seededRandom(index * 7 + 500);
  const r2 = seededRandom(index * 7 + 501);
  
  // 铃铛分布在树的中上部（30%-85%高度）
  const heightRatio = 0.3 + r1 * 0.55;
  const y = (heightRatio * treeHeight) - (treeHeight / 2);
  
  // 根据高度计算当前半径（锥形）
  const currentRadius = (treeRadius * (1 - heightRatio)) * 0.9;
  const theta = r2 * Math.PI * 2;
  
  return new THREE.Vector3(
    currentRadius * Math.cos(theta),
    y,
    currentRadius * Math.sin(theta)
  );
};

// 生成散开状态的位置
const generateScatterPosition = (index: number): THREE.Vector3 => {
  const r1 = seededRandom(index * 11 + 700);
  const r2 = seededRandom(index * 11 + 701);
  const r3 = seededRandom(index * 11 + 702);
  
  // 散开到更大的球形区域
  const radius = 8 + r1 * 12;
  const theta = r2 * Math.PI * 2;
  const phi = r3 * Math.PI;
  
  return new THREE.Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
};

// 缓动函数
const easeInOut = (t: number): number => {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
};

interface BellOrnamentsProps {
  config: BellConfig;
  state?: SceneState;
  treeHeight?: number;
  treeRadius?: number;
}

export const BellOrnaments = ({ 
  config, 
  state = 'FORMED',
  treeHeight = CONFIG.tree.height,
  treeRadius = CONFIG.tree.radius
}: BellOrnamentsProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);
  const progressRef = useRef(state === 'FORMED' ? 1 : 0);
  
  // 散开位置引用
  const scatterPositionsRef = useRef<THREE.Vector3[]>([]);
  
  // 材质引用（用于动态更新发光）
  const materialsRef = useRef<THREE.MeshStandardMaterial[]>([]);
  
  // 铃铛数据
  const bellsData = useMemo(() => {
    return new Array(config.count).fill(0).map((_, i) => {
      const position = generateBellPosition(i, treeHeight, treeRadius);
      const r1 = seededRandom(i * 5 + 600);
      const r2 = seededRandom(i * 5 + 601);
      const r3 = seededRandom(i * 5 + 602);
      const r4 = seededRandom(i * 5 + 603);
      
      return {
        position,
        // 每个铃铛有不同的摆动相位，避免同步
        swingPhase: r1 * Math.PI * 2,
        // 轻微的大小变化
        sizeVariation: 0.85 + r2 * 0.3,
        // 初始旋转
        initialRotation: r1 * Math.PI * 2,
        // 聚合延迟（用于错开动画）
        gatherDelay: r3 * 0.3,
        // 闪烁相位和速度（每个铃铛不同）
        blinkPhase: r4 * Math.PI * 2,
        blinkSpeed: 1.5 + r1 * 2
      };
    });
  }, [config.count, treeHeight, treeRadius]);
  
  // 初始化散开位置
  useEffect(() => {
    scatterPositionsRef.current = bellsData.map((_, i) => generateScatterPosition(i));
  }, [bellsData]);
  
  // 为每个铃铛创建独立的发光材质
  const bellMaterials = useMemo(() => {
    const materials = bellsData.map(() => {
      return new THREE.MeshStandardMaterial({
        color: config.color,
        metalness: 0.8,
        roughness: 0.2,
        emissive: config.color,
        emissiveIntensity: 0.5,
        envMapIntensity: 2
      });
    });
    materialsRef.current = materials;
    return materials;
  }, [config.color, bellsData.length]);
  
  // 动画持续时间
  const duration = 1.2;
  
  // 摆动动画 + 聚合/散开动画
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    
    timeRef.current += delta;
    const time = timeRef.current;
    
    const isFormed = state === 'FORMED';
    const targetProgress = isFormed ? 1 : 0;
    
    // 更新进度
    const step = delta / duration;
    if (targetProgress > progressRef.current) {
      progressRef.current = Math.min(targetProgress, progressRef.current + step);
    } else if (targetProgress < progressRef.current) {
      progressRef.current = Math.max(targetProgress, progressRef.current - step);
    }
    const rawT = progressRef.current;
    
    groupRef.current.children.forEach((bellGroup, i) => {
      const data = bellsData[i];
      if (!data) return;
      
      const scatterPos = scatterPositionsRef.current[i];
      if (!scatterPos) return;
      
      // 基于延迟的进度计算
      const delay = data.gatherDelay;
      let elementT: number;
      if (delay === 0) {
        elementT = easeInOut(rawT);
      } else {
        const adjustedT = Math.max(0, Math.min(1, (rawT - delay) / (1 - delay)));
        elementT = easeInOut(adjustedT);
      }
      
      // 插值位置：从散开位置到聚合位置
      const currentPos = scatterPos.clone().lerp(data.position, elementT);
      bellGroup.position.copy(currentPos);
      
      // 计算摆动角度：sin 函数实现来回摆动
      // 聚合状态下摆动更明显，散开状态下减弱
      const swingMultiplier = elementT;
      const swingAngle = Math.sin(
        time * config.swingSpeed + data.swingPhase
      ) * config.swingAmplitude * swingMultiplier;
      
      // 应用摆动旋转（绕 Z 轴）
      bellGroup.rotation.z = swingAngle;
      // 轻微的前后摆动
      bellGroup.rotation.x = swingAngle * 0.3;
      
      // 散开时添加旋转效果
      if (!isFormed) {
        bellGroup.rotation.y += delta * (1 - elementT) * 2;
      }
      
      // 更新发光闪烁效果
      const material = materialsRef.current[i];
      if (material) {
        // 计算闪烁强度：基于 sin 函数，每个铃铛有不同的相位和速度
        const blinkValue = (Math.sin(time * data.blinkSpeed + data.blinkPhase) + 1) / 2;
        // 聚合状态下发光更强
        const baseIntensity = isFormed ? 0.8 : 0.3;
        const maxIntensity = isFormed ? 2.5 : 1.0;
        material.emissiveIntensity = baseIntensity + blinkValue * (maxIntensity - baseIntensity);
      }
    });
  });
  
  // 清理资源
  useEffect(() => {
    return () => {
      bellMaterials.forEach(m => m.dispose());
    };
  }, [bellMaterials]);

  if (!config.enabled) return null;

  return (
    <group ref={groupRef}>
      {bellsData.map((data, i) => (
        <group 
          key={i} 
          position={data.position}
          rotation={[0, data.initialRotation, 0]}
        >
          {/* 吊环 */}
          <mesh 
            position={[0, 0.6 * config.size * data.sizeVariation, 0]}
            material={bellMaterials[i]}
          >
            <torusGeometry args={[
              0.12 * config.size * data.sizeVariation, 
              0.03 * config.size * data.sizeVariation, 
              8, 
              16
            ]} />
          </mesh>
          
          {/* 铃铛主体 - 使用 lathe 几何体创建铃铛形状 */}
          <mesh 
            position={[0, 0, 0]}
            material={bellMaterials[i]}
          >
            <latheGeometry args={[
              // 铃铛轮廓点
              [
                new THREE.Vector2(0, 0.5 * config.size * data.sizeVariation),      // 顶部中心
                new THREE.Vector2(0.15 * config.size * data.sizeVariation, 0.45 * config.size * data.sizeVariation),  // 顶部边缘
                new THREE.Vector2(0.2 * config.size * data.sizeVariation, 0.3 * config.size * data.sizeVariation),   // 上部
                new THREE.Vector2(0.25 * config.size * data.sizeVariation, 0.1 * config.size * data.sizeVariation),  // 中部
                new THREE.Vector2(0.35 * config.size * data.sizeVariation, -0.2 * config.size * data.sizeVariation), // 下部扩展
                new THREE.Vector2(0.4 * config.size * data.sizeVariation, -0.35 * config.size * data.sizeVariation), // 底部边缘
                new THREE.Vector2(0.38 * config.size * data.sizeVariation, -0.4 * config.size * data.sizeVariation), // 底部内收
              ],
              24  // 分段数
            ]} />
          </mesh>
          
          {/* 铃舌 */}
          <mesh 
            position={[0, -0.25 * config.size * data.sizeVariation, 0]}
            material={bellMaterials[i]}
          >
            <sphereGeometry args={[
              0.08 * config.size * data.sizeVariation, 
              8, 
              8
            ]} />
          </mesh>
          
          {/* 铃舌连接杆 */}
          <mesh 
            position={[0, 0.05 * config.size * data.sizeVariation, 0]}
            material={bellMaterials[i]}
          >
            <cylinderGeometry args={[
              0.02 * config.size * data.sizeVariation,
              0.02 * config.size * data.sizeVariation,
              0.5 * config.size * data.sizeVariation,
              8
            ]} />
          </mesh>
          
          {/* 发光点光源 - 让铃铛照亮周围 */}
          <pointLight
            position={[0, 0, 0]}
            color={config.color}
            intensity={0.5}
            distance={2}
            decay={2}
          />
        </group>
      ))}
    </group>
  );
};
