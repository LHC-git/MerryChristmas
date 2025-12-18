import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'christmas_shares';
const MAX_SIZE_MB = 50;
const EXPIRE_DAYS = 7;

// 分享数据类型（内联定义，避免导入问题）
interface ShareData {
  id: string;
  photos: string[];
  musicUrl?: string;
  message?: string;
  createdAt: number;
  expiresAt: number;
  config: Record<string, unknown>;
}

// 获取所有分享数据
export const getAllShares = (): ShareData[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const shares: ShareData[] = JSON.parse(data);
    const now = Date.now();
    return shares.filter(s => s.expiresAt > now);
  } catch {
    return [];
  }
};

// 根据 ID 获取分享数据
export const getShareById = (id: string): ShareData | null => {
  const shares = getAllShares();
  return shares.find(s => s.id === id) || null;
};

// 计算数据大小 (MB)
const getDataSizeMB = (data: ShareData): number => {
  const str = JSON.stringify(data);
  return new Blob([str]).size / (1024 * 1024);
};

// 保存分享数据
export const saveShare = (
  photos: string[],
  config: Record<string, unknown>,
  message?: string,
  musicUrl?: string
): { success: boolean; id?: string; error?: string } => {
  const id = uuidv4();
  const now = Date.now();
  
  const shareData: ShareData = {
    id,
    photos,
    config,
    message,
    musicUrl,
    createdAt: now,
    expiresAt: now + EXPIRE_DAYS * 24 * 60 * 60 * 1000,
  };
  
  const sizeMB = getDataSizeMB(shareData);
  if (sizeMB > MAX_SIZE_MB) {
    return { success: false, error: `数据大小 ${sizeMB.toFixed(1)}MB 超过限制 ${MAX_SIZE_MB}MB` };
  }
  
  try {
    const shares = getAllShares();
    shares.push(shareData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shares));
    return { success: true, id };
  } catch {
    return { success: false, error: '存储失败，可能空间不足' };
  }
};

// 删除分享
export const deleteShare = (id: string): boolean => {
  try {
    const shares = getAllShares();
    const filtered = shares.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch {
    return false;
  }
};

// 清理过期数据
export const cleanExpired = (): void => {
  const shares = getAllShares(); // 已经过滤了过期数据
  localStorage.setItem(STORAGE_KEY, JSON.stringify(shares));
};

// 图片转 base64 (从 utils/helpers 重新导出)
export { fileToBase64 } from './utils/helpers';
