import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AuroraConfig } from '../../types';

// 极光顶点着色器 - 添加波浪形变形
const auroraVertexShader = `
  uniform float uTime;
  uniform float uWaveSpeed;
  
  varying vec2 vUv;
  varying float vY;
  varying float vWave;
  
  void main() {
    vUv = uv;
    
    // 基础位置
    vec3 pos = position;
    
    // 多层波浪变形
    float wave1 = sin(uv.x * 6.28318 * 2.0 + uTime * uWaveSpeed * 0.5) * 8.0;
    float wave2 = sin(uv.x * 6.28318 * 4.0 - uTime * uWaveSpeed * 0.7) * 4.0;
    float wave3 = sin(uv.x * 6.28318 * 8.0 + uTime * uWaveSpeed * 0.3) * 2.0;
    
    // 垂直方向的波动（极光帘幕效果）
    float verticalWave = (wave1 + wave2 + wave3) * (1.0 - uv.y * 0.5);
    pos.y += verticalWave;
    
    // 水平方向的轻微波动
    float horizontalWave = sin(uv.y * 10.0 + uTime * uWaveSpeed * 0.4) * 3.0;
    pos.x += horizontalWave * (1.0 - abs(uv.y - 0.5) * 2.0);
    
    vY = pos.y;
    vWave = (wave1 + wave2) / 12.0;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

// 极光片段着色器 - 上下边界模糊
const auroraFragmentShader = `
  uniform float uTime;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform float uIntensity;
  uniform float uWaveSpeed;
  uniform float uCoverage;
  
  varying vec2 vUv;
  varying float vY;
  varying float vWave;
  
  // 噪声函数
  float noise(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }
  
  // 平滑噪声
  float smoothNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    
    float a = noise(i);
    float b = noise(i + vec2(1.0, 0.0));
    float c = noise(i + vec2(0.0, 1.0));
    float d = noise(i + vec2(1.0, 1.0));
    
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  
  // 分形噪声
  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    
    for (int i = 0; i < 5; i++) {
      value += amplitude * smoothNoise(p * frequency);
      amplitude *= 0.5;
      frequency *= 2.0;
    }
    
    return value;
  }
  
  void main() {
    float time = uTime * uWaveSpeed * 0.3;
    
    // 创建多层波动效果
    float wave1 = sin(vUv.x * 6.28318 * 3.0 + time) * 0.5 + 0.5;
    float wave2 = sin(vUv.x * 6.28318 * 5.0 - time * 1.3) * 0.5 + 0.5;
    float wave3 = sin(vUv.x * 6.28318 * 7.0 + time * 0.7) * 0.5 + 0.5;
    
    // 噪声扰动
    float n = fbm(vec2(vUv.x * 4.0 + time * 0.5, vUv.y * 3.0));
    
    // 上下边界模糊效果 - 使用 smoothstep 创建柔和渐变
    float bottomFade = smoothstep(0.0, 0.25, vUv.y);  // 底部渐隐
    float topFade = smoothstep(1.0, 0.7, vUv.y);      // 顶部渐隐
    float edgeFade = bottomFade * topFade;
    
    // 垂直渐变（中间最亮）
    float verticalGradient = sin(vUv.y * 3.14159) * 0.8 + 0.2;
    
    // 水平变化
    float horizontalVariation = (wave1 * 0.4 + wave2 * 0.35 + wave3 * 0.25) * n;
    
    // 极光帘幕效果 - 垂直条纹
    float curtainX = vUv.x * 6.28318;
    float curtain = sin(curtainX * 8.0 + time * 2.0) * 0.5 + 0.5;
    curtain = pow(curtain, 0.5) * 0.6 + 0.4;
    
    // 颜色混合 - 基于位置和时间
    float colorMix1 = sin(vUv.x * 6.28318 * 2.0 + time * 0.5) * 0.5 + 0.5;
    float colorMix2 = sin(vUv.x * 6.28318 * 3.0 - time * 0.3 + vUv.y * 2.0) * 0.5 + 0.5;
    
    vec3 color = mix(uColor1, uColor2, colorMix1);
    color = mix(color, uColor3, colorMix2 * 0.6);
    
    // 添加亮度变化
    color *= 0.8 + horizontalVariation * 0.4;
    
    // 最终透明度 - 结合所有效果
    float alpha = curtain * verticalGradient * edgeFade * uIntensity * uCoverage;
    
    // 添加闪烁效果
    float sparkle = smoothNoise(vec2(vUv.x * 30.0 + time * 3.0, vUv.y * 15.0));
    alpha += sparkle * 0.15 * edgeFade;
    
    // 波浪影响透明度
    alpha *= 0.7 + vWave * 0.3;
    
    gl_FragColor = vec4(color, alpha * 0.7);
  }
`;

interface AuroraProps {
  config: AuroraConfig;
}

export const Aurora = ({ config }: AuroraProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const materialsRef = useRef<THREE.ShaderMaterial[]>([]);
  
  // 解析颜色
  const colors = useMemo(() => {
    return config.colors.map(c => new THREE.Color(c));
  }, [config.colors]);
  
  // 创建多个极光面板环绕场景
  const panels = useMemo(() => {
    const count = 6; // 6个面板环绕
    const radius = 180; // 距离中心的半径（与星空背景类似）
    const height = 100; // 极光高度
    const width = 200; // 每个面板宽度
    
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      const rotationY = -angle + Math.PI; // 面向中心
      
      return {
        position: [x, 60, z] as [number, number, number],
        rotation: [0, rotationY, 0] as [number, number, number],
        width,
        height,
        // 每个面板有轻微的高度和位置变化
        heightOffset: (Math.random() - 0.5) * 20,
        phaseOffset: i * 0.5
      };
    });
  }, []);
  
  // 为每个面板创建 uniforms
  const uniformsArray = useMemo(() => {
    return panels.map((panel) => ({
      uTime: { value: panel.phaseOffset },
      uColor1: { value: colors[0] },
      uColor2: { value: colors[1] },
      uColor3: { value: colors[2] },
      uIntensity: { value: config.intensity },
      uWaveSpeed: { value: config.waveSpeed },
      uCoverage: { value: config.coverage }
    }));
  }, [panels, colors, config.intensity, config.waveSpeed, config.coverage]);
  
  // 更新 uniforms 当配置改变时
  useMemo(() => {
    materialsRef.current.forEach((material) => {
      if (material) {
        material.uniforms.uColor1.value = colors[0];
        material.uniforms.uColor2.value = colors[1];
        material.uniforms.uColor3.value = colors[2];
        material.uniforms.uIntensity.value = config.intensity;
        material.uniforms.uWaveSpeed.value = config.waveSpeed;
        material.uniforms.uCoverage.value = config.coverage;
      }
    });
  }, [colors, config.intensity, config.waveSpeed, config.coverage]);
  
  // 动画更新
  useFrame((_, delta) => {
    materialsRef.current.forEach((material) => {
      if (material) {
        material.uniforms.uTime.value += delta;
      }
    });
  });

  if (!config.enabled) return null;

  return (
    <group ref={groupRef}>
      {panels.map((panel, i) => (
        <mesh
          key={i}
          position={[panel.position[0], panel.position[1] + panel.heightOffset, panel.position[2]]}
          rotation={panel.rotation}
        >
          <planeGeometry args={[panel.width, panel.height, 64, 48]} />
          <shaderMaterial
            ref={(el) => { if (el) materialsRef.current[i] = el; }}
            vertexShader={auroraVertexShader}
            fragmentShader={auroraFragmentShader}
            uniforms={uniformsArray[i]}
            transparent
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
};
