# 🚀 GitHub Pages 部署指南

本项目已配置好 GitHub Actions 自动部署到 GitHub Pages，按照以下步骤操作即可。

---

## 📋 前置要求

- GitHub 账号
- Git 已安装

---

## 🔧 配置步骤

### 第 1 步：在 GitHub 创建仓库

1. 访问 https://github.com/new
2. 填写仓库名称（例如：`christmas-tree`）
3. 选择 **Public**（公开仓库才能免费使用 GitHub Pages）
4. **不要**勾选 "Add a README file"（避免冲突）
5. 点击 "Create repository"

### 第 2 步：推送代码到 GitHub

在项目目录下执行以下命令：

```powershell
# 1. 确保已初始化 Git 仓库（本项目已初始化）
# git init  # 如果未初始化才需要执行

# 2. 添加所有文件
git add .

# 3. 提交代码
git commit -m "Initial commit: Christmas Tree Ultra"

# 4. 添加远程仓库（替换成你的 GitHub 用户名和仓库名）
git remote add origin https://github.com/你的用户名/仓库名.git

# 或者使用 SSH（如果配置了 SSH 密钥）
# git remote add origin git@github.com:你的用户名/仓库名.git

# 5. 推送到 GitHub
git branch -M main
git push -u origin main
```

### 第 3 步：在 GitHub 启用 Pages

1. 进入你的 GitHub 仓库页面
2. 点击 **Settings**（设置）
3. 在左侧菜单找到 **Pages**
4. 在 "Build and deployment" 部分：
   - **Source** 选择：`GitHub Actions`
5. 保存后，GitHub Actions 会自动开始部署

### 第 4 步：等待部署完成

1. 点击仓库顶部的 **Actions** 标签
2. 查看 "Deploy to GitHub Pages" 工作流
3. 等待绿色对勾 ✅ 出现（通常需要 2-5 分钟）

### 第 5 步：访问你的网站

部署成功后，访问地址为：

```
https://你的用户名.github.io/仓库名/
```

例如：`https://johndoe.github.io/christmas-tree/`

---

## 🎯 重要说明

### ✅ vite.config.ts 配置

本项目已使用相对路径配置：

```typescript
export default defineConfig({
  base: './', // 相对路径，兼容 GitHub Pages
})
```

这样配置可以同时支持：
- ✅ GitHub Pages 子目录部署
- ✅ 根域名部署
- ✅ 本地预览

### 📁 项目结构说明

```
.github/workflows/deploy.yml  ← GitHub Actions 自动部署配置
dist/                         ← 构建输出目录（自动生成）
public/                       ← 静态资源（音乐、照片等）
src/                          ← 源代码
```

### 🔄 后续更新流程

每次修改代码后，只需：

```bash
git add .
git commit -m "更新描述"
git push
```

GitHub Actions 会自动重新构建和部署。

---

## ⚠️ 常见问题

### Q1: 推送代码时提示权限错误？

**A:** 使用 Personal Access Token（个人访问令牌）：

1. 访问 https://github.com/settings/tokens
2. 点击 "Generate new token (classic)"
3. 勾选 `repo` 权限
4. 复制生成的 token
5. 推送时使用 token 作为密码

### Q2: Actions 部署失败？

**A:** 检查以下几点：

1. 仓库必须是 **Public**（公开）
2. 在 Settings > Actions > General 中确保：
   - "Actions permissions" 设置为 "Allow all actions"
   - "Workflow permissions" 设置为 "Read and write permissions"

### Q3: 网站显示 404？

**A:** 确保：

1. Actions 部署已成功（绿色对勾）
2. Settings > Pages 中的 Source 选择了 "GitHub Actions"
3. 等待 5-10 分钟让 DNS 生效

### Q4: 页面加载但资源 404？

**A:** 检查 `vite.config.ts` 中的 `base` 配置：

- 使用 `base: './'`（推荐，相对路径）
- 或使用 `base: '/仓库名/'`（绝对路径，需要匹配仓库名）

### Q5: 想要自定义域名？

**A:** 在 Settings > Pages 中：

1. 在 "Custom domain" 输入你的域名（如：tree.example.com）
2. 在域名解析商添加 CNAME 记录指向：`你的用户名.github.io`
3. 等待 DNS 生效后，勾选 "Enforce HTTPS"

---

## 🎨 自定义配置

### 更换仓库地址

如果需要更换 GitHub 仓库：

```bash
# 查看当前远程仓库
git remote -v

# 删除旧的远程仓库
git remote remove origin

# 添加新的远程仓库
git remote add origin https://github.com/新用户名/新仓库名.git

# 推送
git push -u origin main
```

### 修改分支名称

GitHub Actions 配置默认监听 `main` 分支，如果你使用其他分支：

编辑 `.github/workflows/deploy.yml`：

```yaml
on:
  push:
    branches:
      - master  # 改为你的分支名
```

---

## 📊 部署状态徽章

在 README.md 中添加部署状态徽章：

```markdown
[![Deploy Status](https://github.com/你的用户名/仓库名/actions/workflows/deploy.yml/badge.svg)](https://github.com/你的用户名/仓库名/actions)
```

---

## 🔗 相关链接

- [GitHub Pages 官方文档](https://docs.github.com/pages)
- [GitHub Actions 文档](https://docs.github.com/actions)
- [Vite 部署文档](https://vitejs.dev/guide/static-deploy.html#github-pages)

---

## 💡 其他部署选项

如果不想使用 GitHub Pages，还可以选择：

- **Netlify**: 拖拽 `dist` 目录即可部署
- **Cloudflare Pages**: 连接 GitHub 自动部署
- **Gitee Pages**: 国内访问更快（但需要实名认证）
- **本地服务器**: 构建后使用 nginx、Apache 等

详见 [DEPLOYMENT.md](./DEPLOYMENT.md)

---

🎄 祝你部署顺利！如有问题欢迎提 Issue。
