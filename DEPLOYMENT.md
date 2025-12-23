# 部署指南

## 方案1：本地运行（推荐 - 最简单）

直接在本地启动开发服务器，无需任何部署：

```bash
npm run dev
# 或
pnpm dev
```

访问 http://localhost:5173 即可查看。

---

## 方案2：GitHub Pages（推荐 - 免费无代理）

### 步骤：

1. **在 GitHub 上创建仓库并推送代码**

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/你的用户名/仓库名.git
git push -u origin main
```

2. **在 GitHub 仓库设置中启用 Pages**

- 进入仓库的 Settings > Pages
- Source 选择 "GitHub Actions"
- 保存

3. **推送代码后自动部署**

每次推送到 main 分支，GitHub Actions 会自动构建并部署。

访问地址：`https://你的用户名.github.io/仓库名/`

---

## 方案3：直接使用构建文件（最简单 - 适合本地/局域网）

1. **构建项目**

```bash
npm run build
```

2. **使用任意静态文件服务器**

### 方法A：使用 Python（推荐）

```bash
cd dist
python -m http.server 8080
```

访问 http://localhost:8080

### 方法B：使用 Node.js serve

```bash
npm install -g serve
cd dist
serve -s . -p 8080
```

### 方法C：使用 http-server

```bash
npm install -g http-server
cd dist
http-server -p 8080
```

### 方法D：使用 VS Code Live Server 插件

- 安装 Live Server 扩展
- 右键 dist/index.html
- 选择 "Open with Live Server"

---

## 方案4：Gitee Pages（国内，无需代理）

1. 在 Gitee 创建仓库并推送代码
2. 进入仓库的 服务 > Gitee Pages
3. 选择 main 分支和 dist 目录
4. 点击启动

注意：需要先本地构建后再推送 dist 目录

---

## 方案5：局域网分享

启动开发服务器后，可通过局域网访问：

```bash
npm run dev -- --host
```

手机/其他设备访问：`http://你的电脑IP:5173`

查看本机 IP：

```bash
# Windows
ipconfig

# Mac/Linux
ifconfig
```

---

## 推荐方案对比

| 方案 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| 本地运行 | 最简单，即开即用 | 只能本机访问 | 开发测试 |
| GitHub Pages | 免费，自动部署，全球访问 | 需要 GitHub 账号 | 长期部署 |
| Python/Node 服务器 | 简单，可局域网访问 | 需要保持命令行运行 | 临时分享 |
| Gitee Pages | 国内速度快 | 需要手动构建 | 国内用户 |

## 注意事项

- 如果使用 GitHub Pages，记得修改 `vite.config.ts` 中的 `base` 配置为你的仓库名
- 音乐文件和照片需要在构建前放在 `public/` 目录下
- 首次访问可能需要允许摄像头和麦克风权限（手势识别功能）
