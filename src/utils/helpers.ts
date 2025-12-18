import { CONFIG } from '../config';

// 检测是否为移动端
export const isMobile = (): boolean => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth < 768;
};

// 生成树形位置
export const getTreePosition = (): [number, number, number] => {
  const h = CONFIG.tree.height;
  const rBase = CONFIG.tree.radius;
  const y = (Math.random() * h) - (h / 2);
  const normalizedY = (y + (h / 2)) / h;
  const currentRadius = rBase * (1 - normalizedY);
  const theta = Math.random() * Math.PI * 2;
  const r = Math.random() * currentRadius;
  return [r * Math.cos(theta), y, r * Math.sin(theta)];
};

// 图片转 base64
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};
