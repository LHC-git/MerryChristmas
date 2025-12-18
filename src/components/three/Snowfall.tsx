import { useRef, useMemo, useEffect } from 'react';
import { useFrame, extend } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { CONFIG } from '../../config';
import type { SceneConfig } from '../../types';

// Snowflake Shader Material
const SnowflakeMaterial = shaderMaterial(
  { uOpacity: 0.8, uColor: new THREE.Color('#ffffff') },
  `attribute float aSize;
  varying float vSize;
  void main() {
    vSize = aSize;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }`,
  `uniform float uOpacity;
  uniform vec3 uColor;
  varying float vSize;
  
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float angle = atan(uv.y, uv.x);
    float dist = length(uv);
    
    float sector = mod(angle + 3.14159, 1.0472) - 0.5236;
    float sectorDist = abs(sector);
    float branch = smoothstep(0.08, 0.02, sectorDist) * smoothstep(0.5, 0.1, dist);
    float center = smoothstep(0.12, 0.08, dist);
    float subAngle = mod(angle + 3.14159, 0.5236) - 0.2618;
    float subBranch = smoothstep(0.06, 0.02, abs(subAngle)) * smoothstep(0.4, 0.15, dist) * smoothstep(0.15, 0.25, dist);
    float shape = max(max(branch, center), subBranch * 0.7);
    shape *= smoothstep(0.5, 0.35, dist);
    
    if (shape < 0.1) discard;
    gl_FragColor = vec4(uColor, shape * uOpacity);
  }`
);
extend({ SnowflakeMaterial });

interface SnowfallProps {
  config: SceneConfig['snow'];
}

export const Snowfall = ({ config }: SnowfallProps) => {
  const { snow } = CONFIG;
  const count = config.count;
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<any>(null);

  const { positions, velocities, sizes } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * snow.area.width;
      positions[i * 3 + 1] = Math.random() * snow.area.height + 20;
      positions[i * 3 + 2] = (Math.random() - 0.5) * snow.area.width;
      velocities[i * 3] = (Math.random() - 0.5) * snow.drift;
      velocities[i * 3 + 1] = -(config.speed * 0.5 + Math.random() * config.speed);
      velocities[i * 3 + 2] = (Math.random() - 0.5) * snow.drift;
      sizes[i] = config.size * (0.5 + Math.random() * 1.5);
    }
    return { positions, velocities, sizes };
  }, [count, snow, config.size, config.speed]);

  useEffect(() => {
    if (materialRef.current) {
      materialRef.current.uOpacity = config.opacity;
    }
  }, [config.opacity]);

  useFrame((state, delta) => {
    if (!pointsRef.current) return;
    const positionAttr = pointsRef.current.geometry.attributes.position;
    const posArray = positionAttr.array as Float32Array;
    const time = state.clock.elapsedTime;

    for (let i = 0; i < count; i++) {
      posArray[i * 3] += velocities[i * 3] * delta * 2 + Math.sin(time + i) * snow.wobble;
      posArray[i * 3 + 1] += velocities[i * 3 + 1] * delta * 2;
      posArray[i * 3 + 2] += velocities[i * 3 + 2] * delta * 2 + Math.cos(time + i) * snow.wobble;

      if (posArray[i * 3 + 1] < -40) {
        posArray[i * 3] = (Math.random() - 0.5) * snow.area.width;
        posArray[i * 3 + 1] = snow.area.height * 0.75 + Math.random() * 20;
        posArray[i * 3 + 2] = (Math.random() - 0.5) * snow.area.width;
      }
    }
    positionAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
      </bufferGeometry>
      {/* @ts-ignore */}
      <snowflakeMaterial
        ref={materialRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uOpacity={config.opacity}
        uColor={new THREE.Color(snow.color)}
      />
    </points>
  );
};
