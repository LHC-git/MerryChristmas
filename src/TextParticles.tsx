import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface TextParticlesProps {
  text: string;
  visible: boolean;
  color?: string;
  size?: number;
  onComplete?: () => void;
}

// 简单的伪随机数生成器（基于种子）
const seededRandom = (seed: number) => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// 检测是否移动端
const isMobileDevice = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// 使用 Canvas 渲染文字并提取像素点位置
const generateTextPositionsFromCanvas = (
  text: string, 
  scale: number, 
  particleSeeds: Float32Array,
  isMobile: boolean
): Float32Array => {
  const count = particleSeeds.length;
  const targets = new Float32Array(count * 3);
  
  if (!text || text.trim() === '') {
    // 空文字，所有粒子去中心
    for (let i = 0; i < count; i++) {
      targets[i * 3] = 0;
      targets[i * 3 + 1] = 5;
      targets[i * 3 + 2] = 0;
    }
    return targets;
  }
  
  // 创建 Canvas 渲染文字
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    for (let i = 0; i < count; i++) {
      targets[i * 3] = 0;
      targets[i * 3 + 1] = 5;
      targets[i * 3 + 2] = 0;
    }
    return targets;
  }
  
  // 根据文字长度和设备调整字体大小
  const fontSize = isMobile ? 60 : 100;
  const fontFamily = '"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", sans-serif';
  
  // 先测量文字宽度
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = fontSize * 1.2;
  
  // 设置 Canvas 大小（留边距）
  const padding = 20;
  canvas.width = Math.ceil(textWidth + padding * 2);
  canvas.height = Math.ceil(textHeight + padding * 2);
  
  // 重新设置字体（Canvas 大小改变后需要重设）
  ctx.font = `bold ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // 绘制文字
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  
  // 获取像素数据
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  
  // 收集所有非透明像素的位置
  const basePositions: { x: number; y: number }[] = [];
  const sampleStep = isMobile ? 3 : 2; // 采样步长，移动端稀疏一些
  
  for (let y = 0; y < canvas.height; y += sampleStep) {
    for (let x = 0; x < canvas.width; x += sampleStep) {
      const idx = (y * canvas.width + x) * 4;
      const alpha = pixels[idx + 3];
      
      // 只取不透明的像素
      if (alpha > 128) {
        // 转换为 3D 坐标（居中，Y 轴翻转）
        const posX = (x - canvas.width / 2) * scale * 0.1;
        const posY = (canvas.height / 2 - y) * scale * 0.1;
        basePositions.push({ x: posX, y: posY });
      }
    }
  }
  
  if (basePositions.length === 0) {
    for (let i = 0; i < count; i++) {
      targets[i * 3] = 0;
      targets[i * 3 + 1] = 5;
      targets[i * 3 + 2] = 0;
    }
    return targets;
  }
  
  // 每个粒子根据自己的种子选择一个基础位置，并添加固定偏移
  for (let i = 0; i < count; i++) {
    const seed = particleSeeds[i];
    const baseIdx = Math.floor(seededRandom(seed * 1.1) * basePositions.length);
    const base = basePositions[baseIdx];
    
    // 使用种子生成固定的偏移
    const offsetX = (seededRandom(seed * 2.2) - 0.5) * scale * 0.15;
    const offsetY = (seededRandom(seed * 3.3) - 0.5) * scale * 0.15;
    const offsetZ = (seededRandom(seed * 4.4) - 0.5) * 0.3;
    
    targets[i * 3] = base.x + offsetX;
    targets[i * 3 + 1] = base.y + 5 + offsetY;
    targets[i * 3 + 2] = offsetZ;
  }
  
  return targets;
};

export const TextParticles = ({ text, visible, color = '#FFD700', size = 1 }: TextParticlesProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.PointsMaterial>(null);
  const initializedRef = useRef(false);
  const lastTextRef = useRef(text);
  const { camera } = useThree();
  
  const count = 2000; // 粒子数量（增加以支持中文）
  const mobile = isMobileDevice();
  
  // 每个粒子的固定种子（用于动画和位置计算）
  const particleSeeds = useMemo(() => {
    const arr = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      arr[i] = i + 0.5; // 固定种子
    }
    return arr;
  }, []);
  
  // 随机值用于动画浮动
  const randoms = useMemo(() => {
    const arr = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      arr[i] = seededRandom(i * 5.5);
    }
    return arr;
  }, []);
  
  // 目标位置 ref（用于平滑过渡）
  const targetPositionsRef = useRef<Float32Array>(new Float32Array(count * 3));
  
  // 初始化目标位置
  useEffect(() => {
    const scale = mobile ? 0.6 : 1.0;
    targetPositionsRef.current = generateTextPositionsFromCanvas(text, scale, particleSeeds, mobile);
    lastTextRef.current = text;
  }, []);
  
  // 文字变化时只更新目标位置（当前位置保持不变，会平滑过渡）
  useEffect(() => {
    if (text !== lastTextRef.current) {
      const scale = mobile ? 0.6 : 1.0;
      targetPositionsRef.current = generateTextPositionsFromCanvas(text, scale, particleSeeds, mobile);
      lastTextRef.current = text;
    }
  }, [text, particleSeeds, mobile]);
  
  useFrame((state, delta) => {
    if (!pointsRef.current || !groupRef.current) return;
    
    // 根据文字长度计算合适的距离
    const textLength = lastTextRef.current.length;
    const baseDistance = mobile ? 18 : 25;
    const distancePerChar = mobile ? 1.5 : 2;
    const finalDistance = Math.min(60, baseDistance + textLength * distancePerChar);
    
    // 计算目标位置（相机前方）
    const cameraDir = new THREE.Vector3();
    camera.getWorldDirection(cameraDir);
    const targetPos = camera.position.clone().add(cameraDir.multiplyScalar(finalDistance));
    
    // 首次显示时直接设置位置
    if (!initializedRef.current) {
      groupRef.current.position.copy(targetPos);
      initializedRef.current = true;
    } else if (visible) {
      groupRef.current.position.lerp(targetPos, Math.min(delta * 3, 0.15));
    }
    
    // 让文字面向相机
    groupRef.current.quaternion.copy(camera.quaternion);
    
    const posAttr = pointsRef.current.geometry.attributes.position;
    const posArray = posAttr.array as Float32Array;
    const time = state.clock.elapsedTime;
    const targets = targetPositionsRef.current;
    
    // 平滑过渡速度
    const speed = 2.5;
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      
      // 始终向目标位置移动
      posArray[i3] += (targets[i3] - posArray[i3]) * delta * speed;
      posArray[i3 + 1] += (targets[i3 + 1] - posArray[i3 + 1]) * delta * speed;
      posArray[i3 + 2] += (targets[i3 + 2] - posArray[i3 + 2]) * delta * speed;
      
      if (visible) {
        // 轻微浮动效果
        posArray[i3] += Math.sin(time * 1.5 + randoms[i] * 10) * 0.003;
        posArray[i3 + 1] += Math.cos(time * 1.5 + randoms[i] * 10) * 0.003;
      }
    }
    
    posAttr.needsUpdate = true;
    
    // 透明度动画
    if (materialRef.current) {
      const targetOpacity = visible ? 1 : 0;
      materialRef.current.opacity += (targetOpacity - materialRef.current.opacity) * delta * 3;
    }
  });
  
  // 初始位置（用于 bufferAttribute 初始化）
  const initPositions = useMemo(() => {
    const scale = mobile ? 0.6 : 1.0;
    return generateTextPositionsFromCanvas(text, scale, particleSeeds, mobile);
  }, []);
  
  return (
    <group ref={groupRef}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[initPositions.slice(), 3]} />
        </bufferGeometry>
        <pointsMaterial
          ref={materialRef}
          color={color}
          size={(mobile ? 0.12 : 0.25) * size}
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

export default TextParticles;
