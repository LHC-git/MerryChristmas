# ⚠️ public/wasm 和 public/models 文件夹说明

## 为什么这些文件夹是空的？

这些文件夹包含的是大型二进制文件（每个 7-9MB），为了避免仓库过大，我们不将它们提交到 Git。

**这些文件会在构建时自动生成！**

## 文件来源

这些文件来自 `@mediapipe/tasks-vision` npm 包：

- `public/wasm/vision_wasm_internal.wasm` (9.13 MB)
- `public/wasm/vision_wasm_nosimd_internal.wasm` (9.01 MB)  
- `public/models/gesture_recognizer.task` (7.99 MB)
- `public/models/hand_landmarker.task` (7.46 MB)

## 如何获取这些文件？

### 方法 1：通过 npm install（推荐）

```bash
npm install
# 或
pnpm install
```

安装依赖后，这些文件位于：
```
node_modules/@mediapipe/tasks-vision/wasm/
```

### 方法 2：手动复制

安装依赖后，手动复制文件到 public 目录：

```bash
# Windows PowerShell
Copy-Item node_modules/@mediapipe/tasks-vision/wasm/* public/wasm/
```

### 方法 3：构建时自动处理

在 `vite.config.ts` 中已经配置了自动复制（通过插件），运行 `npm run build` 时会自动处理。

## GitHub Actions 部署

GitHub Actions 工作流会自动：
1. 安装 node_modules
2. 这些文件会自动可用
3. 构建时自动复制到 dist 目录

**你不需要手动上传这些文件到 GitHub！**

## 本地开发

如果要本地运行项目：

```bash
# 1. 安装依赖
pnpm install

# 2. 启动开发服务器（会自动从 node_modules 加载）
pnpm dev
```

Vite 开发服务器会自动从 `node_modules` 中读取这些文件。
