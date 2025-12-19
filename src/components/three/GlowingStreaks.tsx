import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CONFIG } from '../../config';

interface Streak {
  angle: number;        // 当前角度
  height: number;       // 当前高度
  speed: number;        // 旋转速度
  heightSpeed: number;  // 上升速度
  radius: number;       // 半径偏移
  tailLength: number;   // 拖尾长度（弧度）
  delay: number;        // 延迟启动
}

interface GlowingStreaksProps {
  count?: number;
  color?: string;
  speed?: number;
  tailLength?: number;
  lineWidth?: number;
  treeHeight?: number;
  treeRadius?: number;
}

export const GlowingStreaks = ({
  count = 5,
  color = '#FFD700',
  speed = 1,
  tailLength = 1.2,
  lineWidth = 3,
  treeHeight: propTreeHeight,
  treeRadius: propTreeRadius
}: GlowingStreaksProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const tubeRefs = useRef<THREE.Mesh[]>([]);

  const treeHeight = propTreeHeight ?? CONFIG.tree.height;
  const baseRadius = propTreeRadius ?? CONFIG.tree.radius;

  // 初始化流线数据
  const streaksData = useRef<Streak[]>([]);
  
  useMemo(() => {
    streaksData.current = [];
    for (let i = 0; i < count; i++) {
      streaksData.current.push({
        angle: (i / count) * Math.PI * 2 + Math.random() * 0.5,
        height: Math.random(),
        speed: (0.6 + Math.random() * 0.4) * speed,
        heightSpeed: (0.08 + Math.random() * 0.06) * speed,
        radius: 1.0 + Math.random() * 0.2,
        tailLength: tailLength * (0.7 + Math.random() * 0.6),
        delay: i * 0.5
      });
    }
  }, [count, speed, tailLength]);

  // 创建管道几何体的函数
  const createTubeGeometry = (points: THREE.Vector3[], radius: number) => {
    if (points.length < 2) return null;
    const curve = new THREE.CatmullRomCurve3(points);
    return new THREE.TubeGeometry(curve, 32, radius, 8, false);
  };

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    
    streaksData.current.forEach((streak, i) => {
      // 延迟启动
      if (time < streak.delay) return;
      
      // 更新角度和高度
      streak.angle += streak.speed * 0.015;
      streak.height += streak.heightSpeed * 0.008;
      
      // 循环：到达顶部后重新从底部开始
      if (streak.height > 1.1) {
        streak.height = -0.1;
        streak.angle = Math.random() * Math.PI * 2;
      }
      
      const tube = tubeRefs.current[i];
      if (!tube) return;
      
      // 生成弧形路径点
      const points: THREE.Vector3[] = [];
      const segments = 24;
      
      for (let j = 0; j <= segments; j++) {
        const t = j / segments;
        const segAngle = streak.angle - t * streak.tailLength;
        const segHeight = streak.height - t * 0.15;
        const clampedHeight = Math.max(0, Math.min(1, segHeight));
        const segRadius = (baseRadius * (1 - clampedHeight * 0.82) + 0.8) * streak.radius;
        
        const x = Math.cos(segAngle) * segRadius;
        const y = clampedHeight * treeHeight - treeHeight / 2 + 1;
        const z = Math.sin(segAngle) * segRadius;
        
        points.push(new THREE.Vector3(x, y, z));
      }
      
      // 更新几何体
      const newGeometry = createTubeGeometry(points, lineWidth * 0.02);
      if (newGeometry && tube.geometry) {
        tube.geometry.dispose();
        tube.geometry = newGeometry;
      }
      
      // 更新透明度（头部亮，尾部暗）
      const material = tube.material as THREE.MeshBasicMaterial;
      if (material) {
        const pulse = 0.7 + 0.3 * Math.sin(time * 4 + i);
        material.opacity = pulse * (streak.height > 0 && streak.height < 1 ? 1 : 0.3);
      }
    });
  });

  const baseColor = new THREE.Color(color);

  return (
    <group ref={groupRef}>
      {Array.from({ length: count }).map((_, i) => (
        <mesh 
          key={i} 
          ref={el => { if (el) tubeRefs.current[i] = el; }}
        >
          <tubeGeometry args={[
            new THREE.CatmullRomCurve3([
              new THREE.Vector3(0, 0, 0),
              new THREE.Vector3(1, 1, 0)
            ]), 8, lineWidth * 0.02, 8, false
          ]} />
          <meshBasicMaterial
            color={baseColor}
            transparent={true}
            opacity={0.9}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
};
