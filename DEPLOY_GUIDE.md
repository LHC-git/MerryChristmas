# 🎄 GitHub Pages 部署指南

## 📌 前置要求

- ✅ 已安装 Git
- ✅ 拥有 GitHub 账号
- ✅ 项目已初始化为 Git 仓库

## 🚀 快速部署（三步走）

### 第一步：在 GitHub 创建仓库

1. 访问 https://github.com/new
2. 仓库名称建议：`christmas-tree` 或 `MerryChristmas`
3. 设置为 **Public**（GitHub Pages 免费版需要公开仓库）
4. **不要**勾选 "Initialize this repository with a README"
5. 点击 **Create repository**

### 第二步：推送代码

#### 选项 A：使用自动化脚本（推荐）

在项目根目录打开 PowerShell，运行：

```powershell
.\deploy-github.ps1
```

按提示输入你的 GitHub 用户名和仓库名，脚本会自动完成所有操作。

#### 选项 B：手动推送

在项目根目录打开 Git Bash 或 PowerShell，执行：

```bash
# 1. 确保所有文件已添加
git add .

# 2. 提交更改
git commit -m "Initial commit: Christmas Tree Ultra"

# 3. 添加远程仓库（替换为你的用户名和仓库名）
git remote add origin https://github.com/你的用户名/你的仓库名.git

# 4. 推送到 GitHub
git push -u origin main
```

如果遇到分支名不是 `main` 的情况：
```bash
git branch -M main
git push -u origin main
```

### 第三步：配置 GitHub Pages

1. 访问你的仓库页面：`https://github.com/你的用户名/你的仓库名`

2. 点击 **Settings**（设置）

3. 在左侧菜单找到 **Pages**

4. 在 **Build and deployment** 部分：
   - **Source** 选择：`GitHub Actions`

5. 等待 2-5 分钟，GitHub Actions 会自动构建和部署

6. 访问你的网站：
   ```
   https://你的用户名.github.io/MerryChristmas/
   ```
   注意：URL 末尾的 `/MerryChristmas/` 是在 vite.config.ts 中配置的 base 路径

## 📊 查看部署状态

1. 在仓库页面点击 **Actions** 标签
2. 查看最新的 workflow 运行状态
3. 绿色勾号 ✅ 表示部署成功
4. 红色叉号 ❌ 表示部署失败（点击查看错误日志）

## ⚙️ 关键配置说明

### 1. Vite 配置（vite.config.ts）

```typescript
base: process.env.NODE_ENV === 'production' ? '/MerryChristmas/' : '/',
```

- **重要**：`/MerryChristmas/` 必须与你的仓库名匹配
- 如果仓库名不是 `MerryChristmas`，需要修改此处

### 2. GitHub Actions 工作流（.github/workflows/deploy.yml）

关键步骤：
- ✅ 自动安装依赖
- ✅ 复制 AI 模型文件到 public 目录
- ✅ 构建生产版本
- ✅ 部署到 GitHub Pages

### 3. AI 模型文件

项目使用 MediaPipe 手势识别，需要以下文件：

**public/models/**
- `gesture_recognizer.task`
- `hand_landmarker.task`

**public/wasm/**
- `vision_wasm_internal.js`
- `vision_wasm_internal.wasm`
- `vision_wasm_nosimd_internal.js`
- `vision_wasm_nosimd_internal.wasm`

这些文件在 GitHub Actions 构建时会自动从 `node_modules` 复制：

```yaml
- name: Copy AI model files
  run: |
    mkdir -p public/wasm public/models
    cp node_modules/@mediapipe/tasks-vision/wasm/* public/wasm/ || true
```

## 🔧 常见问题

### Q1: 页面显示 404

**原因**：base 路径配置错误

**解决**：检查 [vite.config.ts](vite.config.ts) 中的 `base` 是否与仓库名一致

```typescript
// 如果仓库名是 christmas-tree
base: process.env.NODE_ENV === 'production' ? '/christmas-tree/' : '/',
```

### Q2: 摄像头无法使用

**原因**：GitHub Pages 默认使用 HTTPS，但部分功能需要摄像头权限

**解决**：
- GitHub Pages 自动启用 HTTPS，摄像头应该正常工作
- 如果仍有问题，检查浏览器权限设置

### Q3: AI 手势识别不工作

**原因**：模型文件未正确加载

**解决**：
1. 检查浏览器控制台是否有 404 错误
2. 确认 public/models/ 和 public/wasm/ 目录中有文件
3. 查看 GitHub Actions 构建日志，确认文件复制成功

### Q4: 推送时要求输入用户名密码

**原因**：GitHub 不再支持密码认证

**解决**：使用 Personal Access Token (PAT)

1. 访问 https://github.com/settings/tokens
2. 点击 **Generate new token** > **Generate new token (classic)**
3. 勾选 `repo` 权限
4. 生成 token 并保存（只显示一次）
5. 推送时用 token 替代密码

### Q5: 构建失败 - 找不到 pnpm

**原因**：GitHub Actions 配置了 pnpm 但 package.json 未指定

**解决**：项目使用 npm，修改 [.github/workflows/deploy.yml](.github/workflows/deploy.yml)：

删除或注释掉：
```yaml
# - name: Install pnpm
#   uses: pnpm/action-setup@v2
#   with:
#     version: 8
```

### Q6: 音乐或图片无法加载

**原因**：资源路径问题

**解决**：
- 确保所有资源文件都在 public/ 目录下
- Vite 会自动处理 public/ 目录的资源路径

## 🎨 自定义配置

### 修改仓库名后的配置

1. **修改 vite.config.ts**
   ```typescript
   base: process.env.NODE_ENV === 'production' ? '/你的新仓库名/' : '/',
   ```

2. **重新构建部署**
   ```bash
   git add vite.config.ts
   git commit -m "Update base path"
   git push
   ```

### 添加自定义域名

1. 在仓库根目录创建 `public/CNAME` 文件
2. 写入你的域名：`www.yourdomain.com`
3. 在域名提供商添加 CNAME 记录指向 `你的用户名.github.io`
4. 推送代码，等待生效

## 📱 移动端测试

部署成功后，可以在手机浏览器访问：
- iOS Safari
- Android Chrome

手势识别需要摄像头权限，首次访问会提示授权。

## 🔐 Supabase 配置（可选）

如果使用分享功能，需要配置环境变量：

1. 在仓库 **Settings** > **Secrets and variables** > **Actions**
2. 添加 secrets：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

3. 修改 [.github/workflows/deploy.yml](.github/workflows/deploy.yml)：
   ```yaml
   - name: Build
     env:
       VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
       VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
     run: npm run build
   ```

## 🎄 完成！

部署成功后，你的圣诞树应用将在以下地址可用：

```
https://你的用户名.github.io/MerryChristmas/
```

分享链接给朋友，让他们也体验 3D 圣诞树的魅力！ 🎅✨

---

**需要帮助？**

- 查看 [GitHub Actions 日志](https://github.com/你的用户名/你的仓库名/actions)
- 阅读 [GitHub Pages 文档](https://docs.github.com/pages)
- 参考 [Vite 部署指南](https://vitejs.dev/guide/static-deploy.html)
