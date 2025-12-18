import { createClient } from '@supabase/supabase-js';

// Supabase 配置 - 请替换为你的项目信息
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// 分享数据类型
export interface ShareData {
  id: string;
  photos: string[]; // 存储 Supabase Storage 的 URL
  config: Record<string, unknown>;
  message?: string;
  created_at: string;
  expires_at: string;
}

// 上传图片到 Supabase Storage
export const uploadPhoto = async (base64: string, shareId: string, index: number): Promise<string | null> => {
  try {
    // 从 base64 提取数据
    const matches = base64.match(/^data:(.+);base64,(.+)$/);
    if (!matches) return null;
    
    const contentType = matches[1];
    const base64Data = matches[2];
    const ext = contentType.split('/')[1] || 'jpg';
    
    // 转换为 Blob
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: contentType });
    
    const fileName = `${shareId}/${index}.${ext}`;
    
    const { error } = await supabase.storage
      .from('MerryChristmas')
      .upload(fileName, blob, { contentType, upsert: true });
    
    if (error) {
      console.error('Upload error:', error);
      return null;
    }
    
    // 获取公开 URL
    const { data } = supabase.storage.from('MerryChristmas').getPublicUrl(fileName);
    return data.publicUrl;
  } catch (err) {
    console.error('Upload failed:', err);
    return null;
  }
};

// 保存分享数据
export const saveShareToSupabase = async (
  photos: string[], // base64 数组
  config: Record<string, unknown>,
  message?: string
): Promise<{ success: boolean; id?: string; error?: string }> => {
  try {
    const id = crypto.randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7天后过期
    
    // 上传所有图片
    const photoUrls: string[] = [];
    for (let i = 0; i < photos.length; i++) {
      const url = await uploadPhoto(photos[i], id, i);
      if (url) photoUrls.push(url);
    }
    
    if (photoUrls.length === 0) {
      return { success: false, error: '图片上传失败' };
    }
    
    // 保存分享记录
    const { error } = await supabase.from('shares').insert({
      id,
      photos: photoUrls,
      config,
      message,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString()
    });
    
    if (error) {
      console.error('Save error:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, id };
  } catch (err) {
    console.error('Save failed:', err);
    return { success: false, error: '保存失败' };
  }
};

// 获取分享数据
export const getShareFromSupabase = async (id: string): Promise<ShareData | null> => {
  try {
    const { data, error } = await supabase
      .from('shares')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error || !data) return null;
    
    // 检查是否过期
    if (new Date(data.expires_at) < new Date()) {
      return null;
    }
    
    return data as ShareData;
  } catch {
    return null;
  }
};

// 删除过期分享（可以通过 Supabase Edge Function 定时执行）
export const cleanExpiredShares = async (): Promise<void> => {
  const now = new Date().toISOString();
  
  // 获取过期的分享
  const { data: expiredShares } = await supabase
    .from('shares')
    .select('id')
    .lt('expires_at', now);
  
  if (expiredShares && expiredShares.length > 0) {
    for (const share of expiredShares) {
      // 删除存储的图片
      const { data: files } = await supabase.storage
        .from('MerryChristmas')
        .list(share.id);
      
      if (files && files.length > 0) {
        const filePaths = files.map(f => `${share.id}/${f.name}`);
        await supabase.storage.from('MerryChristmas').remove(filePaths);
      }
      
      // 删除数据库记录
      await supabase.from('shares').delete().eq('id', share.id);
    }
  }
};
