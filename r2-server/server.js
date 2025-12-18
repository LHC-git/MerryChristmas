/**
 * R2 存储代理服务 - 用于宝塔部署
 * 
 * 安全特性：
 * - 请求频率限制（Rate Limiting）
 * - 输入验证和清理
 * - 安全响应头
 * - 请求日志
 * 
 * 部署步骤：
 * 1. 宝塔 → 网站 → Node项目 → 添加项目
 * 2. 项目目录选择此文件夹
 * 3. 启动文件：server.js
 * 4. 端口：3001（或其他）
 * 5. 配置反向代理到你的域名
 */

const express = require('express');
const cors = require('cors');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const app = express();
const PORT = process.env.PORT || 3001;

// R2 配置 - 必须从环境变量读取
const R2_CONFIG = {
  accountId: process.env.R2_ACCOUNT_ID,
  accessKeyId: process.env.R2_ACCESS_KEY_ID,
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  bucketName: process.env.R2_BUCKET_NAME || 'merrychristmas'
};

// 验证必要的环境变量
if (!R2_CONFIG.accountId || !R2_CONFIG.accessKeyId || !R2_CONFIG.secretAccessKey) {
  console.error('Missing required R2 environment variables: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY');
  process.exit(1);
}

// 创建 S3 客户端（R2 兼容 S3 API）
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_CONFIG.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_CONFIG.accessKeyId,
    secretAccessKey: R2_CONFIG.secretAccessKey
  }
});

// ============ 安全：请求频率限制 ============
const rateLimitMap = new Map(); // IP -> { count, resetTime }
const RATE_LIMIT = {
  windowMs: 60 * 1000,  // 1 分钟窗口
  maxRequests: 30,      // 每分钟最多 30 次请求
  maxUploads: 5         // 每分钟最多 5 次上传
};

const uploadLimitMap = new Map(); // IP -> { count, resetTime }

function getRateLimitInfo(map, ip, limit) {
  const now = Date.now();
  let info = map.get(ip);
  
  if (!info || now > info.resetTime) {
    info = { count: 0, resetTime: now + RATE_LIMIT.windowMs };
    map.set(ip, info);
  }
  
  return info;
}

function checkRateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  
  let info = rateLimitMap.get(ip);
  if (!info || now > info.resetTime) {
    info = { count: 0, resetTime: now + RATE_LIMIT.windowMs };
  }
  
  info.count++;
  rateLimitMap.set(ip, info);
  
  if (info.count > RATE_LIMIT.maxRequests) {
    console.log(`[RATE LIMIT] IP ${ip} exceeded ${RATE_LIMIT.maxRequests} requests/min`);
    return res.status(429).json({ 
      error: 'Too many requests', 
      retryAfter: Math.ceil((info.resetTime - now) / 1000) 
    });
  }
  
  next();
}

function checkUploadLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  
  let info = uploadLimitMap.get(ip);
  if (!info || now > info.resetTime) {
    info = { count: 0, resetTime: now + RATE_LIMIT.windowMs };
  }
  
  info.count++;
  uploadLimitMap.set(ip, info);
  
  if (info.count > RATE_LIMIT.maxUploads) {
    console.log(`[UPLOAD LIMIT] IP ${ip} exceeded ${RATE_LIMIT.maxUploads} uploads/min`);
    return res.status(429).json({ 
      error: 'Too many uploads', 
      retryAfter: Math.ceil((info.resetTime - now) / 1000) 
    });
  }
  
  next();
}

// 定期清理过期的限流记录
setInterval(() => {
  const now = Date.now();
  for (const [ip, info] of rateLimitMap) {
    if (now > info.resetTime) rateLimitMap.delete(ip);
  }
  for (const [ip, info] of uploadLimitMap) {
    if (now > info.resetTime) uploadLimitMap.delete(ip);
  }
}, 60 * 1000);

// ============ 安全：输入验证 ============
function validateShareId(id) {
  // 只允许 8 位小写字母数字
  return /^[a-z0-9]{8}$/.test(id);
}

function validateEditToken(token) {
  // 只允许 32 位字母数字
  return /^[A-Za-z0-9]{32}$/.test(token);
}

function validateShareData(data) {
  const errors = [];
  
  // 必要字段
  if (!data.id) errors.push('Missing id');
  if (!data.editToken) errors.push('Missing editToken');
  if (!data.createdAt) errors.push('Missing createdAt');
  
  // ID 格式
  if (data.id && !validateShareId(data.id)) {
    errors.push('Invalid id format (must be 8 lowercase alphanumeric)');
  }
  
  // Token 格式
  if (data.editToken && !validateEditToken(data.editToken)) {
    errors.push('Invalid editToken format');
  }
  
  // 照片验证
  if (data.photos) {
    if (!Array.isArray(data.photos)) {
      errors.push('Photos must be an array');
    } else if (data.photos.length > 20) {
      errors.push('Too many photos (max 20)');
    } else {
      for (let i = 0; i < data.photos.length; i++) {
        const photo = data.photos[i];
        if (typeof photo !== 'string') {
          errors.push(`Photo ${i} is not a string`);
        } else if (!photo.startsWith('data:image/')) {
          errors.push(`Photo ${i} is not a valid data URL`);
        } else if (photo.length > 10 * 1024 * 1024) { // 10MB per photo
          errors.push(`Photo ${i} is too large`);
        }
      }
    }
  }
  
  // 消息长度
  if (data.message && (typeof data.message !== 'string' || data.message.length > 200)) {
    errors.push('Message too long (max 200 chars)');
  }
  
  // 配置验证
  if (data.config && typeof data.config !== 'object') {
    errors.push('Config must be an object');
  }
  
  // 时间戳验证
  if (data.createdAt && (typeof data.createdAt !== 'number' || data.createdAt < 0)) {
    errors.push('Invalid createdAt timestamp');
  }
  
  return errors;
}

// ============ 安全：清理敏感数据 ============
function sanitizeForLog(data) {
  if (!data) return data;
  const sanitized = { ...data };
  // 不记录完整的照片数据和 token
  if (sanitized.photos) sanitized.photos = `[${sanitized.photos.length} photos]`;
  if (sanitized.editToken) sanitized.editToken = '***';
  if (sanitized.config) sanitized.config = '[config object]';
  return sanitized;
}

// ============ 中间件 ============

// 安全响应头
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

// 请求体解析（限制大小）
app.use(express.json({ limit: '10mb' }));
app.use(express.text({ limit: '10mb' }));

// 全局请求频率限制
app.use(checkRateLimit);

// 请求日志
app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - IP: ${ip}`);
  next();
});

// ============ 路由 ============

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// GET - 读取文件
app.get('/shares/:id.json', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 验证 ID 格式
    if (!validateShareId(id)) {
      return res.status(400).json({ error: 'Invalid share ID format' });
    }
    
    const key = `shares/${id}.json`;
    
    const command = new GetObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: key
    });
    
    const response = await s3Client.send(command);
    const body = await response.Body.transformToString();
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.send(body);
  } catch (error) {
    if (error.name === 'NoSuchKey') {
      res.status(404).json({ error: 'Not found' });
    } else {
      console.error('[GET ERROR]', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// PUT - 上传/更新文件
app.put('/shares/:id.json', checkUploadLimit, async (req, res) => {
  try {
    const { id } = req.params;
    
    // 验证 ID 格式
    if (!validateShareId(id)) {
      return res.status(400).json({ error: 'Invalid share ID format' });
    }
    
    const key = `shares/${id}.json`;
    let body = req.body;
    
    // 如果是字符串，解析为 JSON
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON' });
      }
    }
    
    // 验证数据
    const validationErrors = validateShareData(body);
    if (validationErrors.length > 0) {
      console.log('[VALIDATION ERROR]', validationErrors);
      return res.status(400).json({ error: 'Validation failed', details: validationErrors });
    }
    
    // 确保 URL 中的 ID 和数据中的 ID 一致
    if (body.id !== id) {
      return res.status(400).json({ error: 'ID mismatch' });
    }
    
    // 检查是否是更新操作，验证 token
    try {
      const getCommand = new GetObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: key
      });
      const existing = await s3Client.send(getCommand);
      const existingBody = await existing.Body.transformToString();
      const existingData = JSON.parse(existingBody);
      
      // 验证 editToken
      if (existingData.editToken !== body.editToken) {
        console.log('[AUTH ERROR] Token mismatch for share:', id);
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      console.log('[UPDATE]', sanitizeForLog(body));
    } catch (error) {
      // 文件不存在，是新建操作
      if (error.name !== 'NoSuchKey') {
        throw error;
      }
      console.log('[CREATE]', sanitizeForLog(body));
    }
    
    // 上传到 R2
    const putCommand = new PutObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: key,
      Body: JSON.stringify(body),
      ContentType: 'application/json'
    });
    
    await s3Client.send(putCommand);
    res.json({ success: true });
  } catch (error) {
    console.error('[PUT ERROR]', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE - 删除文件
app.delete('/shares/:id.json', async (req, res) => {
  try {
    const { id } = req.params;
    const token = req.query.token;
    
    // 验证 ID 格式
    if (!validateShareId(id)) {
      return res.status(400).json({ error: 'Invalid share ID format' });
    }
    
    // 验证 token 存在
    if (!token) {
      return res.status(401).json({ error: 'Token required' });
    }
    
    // 验证 token 格式
    if (!validateEditToken(token)) {
      return res.status(400).json({ error: 'Invalid token format' });
    }
    
    const key = `shares/${id}.json`;
    
    // 验证 token
    try {
      const getCommand = new GetObjectCommand({
        Bucket: R2_CONFIG.bucketName,
        Key: key
      });
      const existing = await s3Client.send(getCommand);
      const existingBody = await existing.Body.transformToString();
      const existingData = JSON.parse(existingBody);
      
      if (existingData.editToken !== token) {
        console.log('[AUTH ERROR] Token mismatch for delete:', id);
        return res.status(401).json({ error: 'Unauthorized' });
      }
    } catch (error) {
      if (error.name === 'NoSuchKey') {
        return res.status(404).json({ error: 'Not found' });
      }
      throw error;
    }
    
    // 删除
    const deleteCommand = new DeleteObjectCommand({
      Bucket: R2_CONFIG.bucketName,
      Key: key
    });
    
    await s3Client.send(deleteCommand);
    console.log('[DELETE] Share:', id);
    res.json({ success: true });
  } catch (error) {
    console.error('[DELETE ERROR]', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('[UNHANDLED ERROR]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 启动服务
app.listen(PORT, () => {
  console.log(`R2 Proxy Server running on port ${PORT}`);
  console.log(`Bucket: ${R2_CONFIG.bucketName}`);
  console.log(`Rate limit: ${RATE_LIMIT.maxRequests} requests/min, ${RATE_LIMIT.maxUploads} uploads/min`);
});
