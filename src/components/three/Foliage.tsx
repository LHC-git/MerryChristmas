import { useRef, useMemo } from 'react';
import { useFrame, extend } from '@react-three/fiber';
import { shaderMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { MathUtils } from 'three';
import * as random from 'maath/random';
import { CONFIG } from '../../config';
import { getTreePosition } from '../../utils/helpers';
import type { SceneState } from '../../types';

// Shader Material
const FoliageMaterial = shaderMaterial(
  { uTime: 0, uColor: new THREE.Color(CONFIG.colors.emerald), uProgress: 0 },
  `uniform float uTime; uniform float uProgress; attribute vec3 aTargetPos; attribute float aRandom;
  varying vec2 vUv; varying float vMix;
  float cubicInOut(float t) { return t < 0.5 ? 4.0 * t * t * t : 0.5 * pow(2.0 * t - 2.0, 3.0) + 1.0; }
  void main() {
    vUv = uv;
    vec3 noise = vec3(sin(uTime * 1.5 + position.x), cos(uTime + position.y), sin(uTime * 1.5 + position.z)) * 0.15;
    float t = cubicInOut(uProgress);
    vec3 finalPos = mix(position, aTargetPos + noise, t);
    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
    gl_PointSize = (60.0 * (1.0 + aRandom)) / -mvPosition.z;
    gl_Position = projectionMatrix * mvPosition;
    vMix = t;
  }`,
  `uniform vec3 uColor; varying float vMix;
  void main() {
    float r = distance(gl_PointCoord, vec2(0.5)); if (r > 0.5) discard;
    vec3 finalColor = mix(uColor * 0.3, uColor * 1.2, vMix);
    gl_FragColor = vec4(finalColor, 1.0);
  }`
);
extend({ FoliageMaterial });

interface FoliageProps {
  state: SceneState;
}

export const Foliage = ({ state }: FoliageProps) => {
  const materialRef = useRef<any>(null);
  
  const { positions, targetPositions, randoms } = useMemo(() => {
    const count = CONFIG.counts.foliage;
    const positions = new Float32Array(count * 3);
    const targetPositions = new Float32Array(count * 3);
    const randoms = new Float32Array(count);
    const spherePoints = random.inSphere(new Float32Array(count * 3), { radius: 25 }) as Float32Array;
    
    for (let i = 0; i < count; i++) {
      positions[i * 3] = spherePoints[i * 3];
      positions[i * 3 + 1] = spherePoints[i * 3 + 1];
      positions[i * 3 + 2] = spherePoints[i * 3 + 2];
      const [tx, ty, tz] = getTreePosition();
      targetPositions[i * 3] = tx;
      targetPositions[i * 3 + 1] = ty;
      targetPositions[i * 3 + 2] = tz;
      randoms[i] = Math.random();
    }
    return { positions, targetPositions, randoms };
  }, []);

  useFrame((rootState, delta) => {
    if (materialRef.current) {
      materialRef.current.uTime = rootState.clock.elapsedTime;
      const targetProgress = state === 'FORMED' ? 1 : 0;
      materialRef.current.uProgress = MathUtils.damp(materialRef.current.uProgress, targetProgress, 1.5, delta);
    }
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aTargetPos" args={[targetPositions, 3]} />
        <bufferAttribute attach="attributes-aRandom" args={[randoms, 1]} />
      </bufferGeometry>
      {/* @ts-ignore */}
      <foliageMaterial ref={materialRef} transparent depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
};
