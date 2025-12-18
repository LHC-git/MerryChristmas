import { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface HeartParticlesProps {
  visible: boolean;
  color?: string;
  count?: number;
}

// 使用更精确的心形参数方程生成均匀分布的点
const generateHeartPoints = (count: number): Float32Array => {
  const positions = new Float32Array(count * 3);
  
  for (let i = 0; i < count; i++) {
    // 使用极坐标心形方程: r = 1 - sin(θ)
    // 但我们用更好看的参数方程
    const t = (i / count) * Math.PI * 5;
    
    // 心形参数方程
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    
    // 填充内部：使用随机缩放因子
    const fillFactor = Math.sqrt(Math.random()); // sqrt 让分布更均匀
    
    positions[i * 3] = x * fillFactor * 0.35;
    positions[i * 3 + 1] = y * fillFactor * 0.35;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 0.5; // 很薄的 z 层
  }
  
  return positions;
};

// 生成随机散开的初始位置
const generateScatteredPositions = (count: number): Float32Array => {
  const positions = new Float32Array(count * 3);
  
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 15 + 5;
    positions[i * 3] = Math.cos(angle) * radius;
    positions[i * 3 + 1] = Math.sin(angle) * radius;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
  }
  
  return positions;
};

export const HeartParticles = ({ visible, color = '#FF1493', count = 1500 }: HeartParticlesProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);
  const progressRef = useRef(0);
  const initializedRef = useRef(false);
  const { camera } = useThree();
  
  const { heartPositions, scatteredPositions } = useMemo(() => ({
    heartPositions: generateHeartPoints(count),
    scatteredPositions: generateScatteredPositions(count)
  }), [count]);
  
  // 初始化位置
  const currentPositions = useMemo(() => {
    return new Float32Array(scatteredPositions);
  }, [scatteredPositions]);
  
  useFrame((_, delta) => {
    if (!pointsRef.current || !groupRef.current || !materialRef.current) return;
    
    // 计算目标位置（相机前方）
    const cameraDir = new THREE.Vector3();
    camera.getWorldDirection(cameraDir);
    const targetPos = camera.position.clone().add(cameraDir.multiplyScalar(20));
    
    // 首次显示时直接设置位置，避免从原点飞过来
    if (!initializedRef.current || visible) {
      if (!initializedRef.current) {
        groupRef.current.position.copy(targetPos);
        initializedRef.current = true;
      } else {
        // 平滑跟随
        groupRef.current.position.lerp(targetPos, Math.min(delta * 3, 0.15));
      }
    }
    
    // 让爱心面向相机
    groupRef.current.quaternion.copy(camera.quaternion);
    
    // 更新动画进度
    const targetProgress = visible ? 1 : 0;
    const progressDelta = (targetProgress - progressRef.current) * Math.min(delta * 4, 0.15);
    progressRef.current += progressDelta;
    const progress = progressRef.current;
    
    // 缓动函数
    const eased = 1 - Math.pow(1 - progress, 3);
    
    // 更新粒子位置
    const posAttr = pointsRef.current.geometry.attributes.position;
    const posArray = posAttr.array as Float32Array;
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      posArray[i3] = scatteredPositions[i3] + (heartPositions[i3] - scatteredPositions[i3]) * eased;
      posArray[i3 + 1] = scatteredPositions[i3 + 1] + (heartPositions[i3 + 1] - scatteredPositions[i3 + 1]) * eased;
      posArray[i3 + 2] = scatteredPositions[i3 + 2] + (heartPositions[i3 + 2] - scatteredPositions[i3 + 2]) * eased;
    }
    
    posAttr.needsUpdate = true;
    
    // 更新透明度
    materialRef.current.opacity = progress * 0.85;
  });
  
  return (
    <group ref={groupRef}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[currentPositions, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          ref={materialRef}
          color={color}
          size={0.25}
          transparent
          opacity={0}
          sizeAttenuation
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
};

export default HeartParticles;
