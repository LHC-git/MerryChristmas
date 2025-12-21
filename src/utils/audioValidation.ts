/**
 * 音频文件验证工具
 */

// 支持的音频格式
export const SUPPORTED_AUDIO_FORMATS = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/m4a', 'audio/x-m4a'];

// 最大时长（秒）
export const MAX_AUDIO_DURATION = 60;

// 最大文件大小（字节）- 10MB
export const MAX_AUDIO_SIZE = 10 * 1024 * 1024;

export interface AudioValidationResult {
  valid: boolean;
  error?: string;
  duration?: number;
}

/**
 * 验证音频文件格式
 */
export function validateAudioFormat(file: File): boolean {
  // 检查 MIME 类型
  if (SUPPORTED_AUDIO_FORMATS.includes(file.type)) {
    return true;
  }
  
  // 检查文件扩展名
  const ext = file.name.toLowerCase().split('.').pop();
  return ['mp3', 'wav', 'm4a', 'mp4'].includes(ext || '');
}

/**
 * 获取音频时长
 */
export function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration);
    };
    
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('无法读取音频文件'));
    };
    
    audio.src = url;
  });
}

/**
 * 完整验证音频文件
 */
export async function validateAudioFile(file: File): Promise<AudioValidationResult> {
  // 检查文件大小
  if (file.size > MAX_AUDIO_SIZE) {
    return {
      valid: false,
      error: `文件过大，最大支持 ${MAX_AUDIO_SIZE / 1024 / 1024}MB`
    };
  }
  
  // 检查格式
  if (!validateAudioFormat(file)) {
    return {
      valid: false,
      error: '不支持的音频格式，请使用 MP3、WAV 或 M4A 格式'
    };
  }
  
  // 检查时长
  try {
    const duration = await getAudioDuration(file);
    
    if (duration > MAX_AUDIO_DURATION) {
      return {
        valid: false,
        error: `音频时长超过 ${MAX_AUDIO_DURATION} 秒限制`,
        duration
      };
    }
    
    return {
      valid: true,
      duration
    };
  } catch (err) {
    return {
      valid: false,
      error: '无法读取音频文件，请确保文件未损坏'
    };
  }
}

/**
 * 将 Blob 转换为 Base64
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * 将 Base64 转换为 Blob
 */
export function base64ToBlob(base64: string): Blob {
  const parts = base64.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);
  
  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  
  return new Blob([uInt8Array], { type: contentType });
}
