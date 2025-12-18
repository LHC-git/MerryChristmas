-- Supabase 数据库设置 SQL
-- 在 Supabase Dashboard -> SQL Editor 中运行

-- 1. 创建分享表
CREATE TABLE IF NOT EXISTS shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photos TEXT[] NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- 2. 创建索引加速过期查询
CREATE INDEX IF NOT EXISTS idx_shares_expires_at ON shares(expires_at);

-- 3. 启用 RLS (Row Level Security)
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;

-- 4. 创建策略：允许所有人读取未过期的分享
CREATE POLICY "Anyone can read non-expired shares" ON shares
  FOR SELECT USING (expires_at > NOW());

-- 5. 创建策略：允许匿名用户插入
CREATE POLICY "Anyone can insert shares" ON shares
  FOR INSERT WITH CHECK (true);

-- 6. 创建自动删除过期数据的函数
CREATE OR REPLACE FUNCTION delete_expired_shares()
RETURNS void AS $$
BEGIN
  -- 删除过期的分享记录
  DELETE FROM shares WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- 7. 创建定时任务（需要 pg_cron 扩展，Supabase 默认启用）
-- 每天凌晨 3 点清理过期数据
SELECT cron.schedule(
  'cleanup-expired-shares',
  '0 3 * * *',
  'SELECT delete_expired_shares()'
);

-- 注意：Storage 中的文件需要通过 Edge Function 或手动清理
-- 可以创建一个 Edge Function 来同步删除 Storage 文件

-- ============================================
-- Storage 设置（在 Supabase Dashboard 中操作）
-- ============================================
-- 1. 进入 Storage 页面
-- 2. 创建 bucket: shares
-- 3. 设置为 Public bucket
-- 4. 添加策略：
--    - SELECT: 允许所有人读取
--    - INSERT: 允许所有人上传
--    - DELETE: 允许所有人删除（用于清理）
