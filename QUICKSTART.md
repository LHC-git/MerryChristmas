# 🚀 GitHub Pages 快速上手

## 三步部署你的圣诞树网页

### 方式一：使用自动脚本（推荐）

```powershell
.\deploy-github.ps1
```

按照提示输入 GitHub 用户名和仓库名，脚本会自动完成所有配置。

---

### 方式二：手动部署

#### 1️⃣ 创建 GitHub 仓库

访问 https://github.com/new
- 仓库名：`christmas-tree`（可自定义）
- 类型：**Public**（公开）
- 不要勾选任何初始化选项

#### 2️⃣ 推送代码

```powershell
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/你的用户名/christmas-tree.git
git push -u origin main
```

#### 3️⃣ 启用 GitHub Pages

1. 进入仓库的 **Settings** > **Pages**
2. **Source** 选择：`GitHub Actions`
3. 等待 2-5 分钟自动部署

#### 4️⃣ 访问网站

```
https://你的用户名.github.io/christmas-tree/
```

---

## 📌 注意事项

✅ 仓库必须是 **Public**（公开）
✅ 确保网络连接正常
✅ 首次推送需要 GitHub 登录凭证

---

## ❓ 遇到问题？

查看详细文档：
- [完整部署指南](./GITHUB_PAGES_SETUP.md)
- [多种部署方式](./DEPLOYMENT.md)

---

🎄 **现在就开始部署你的专属圣诞树吧！**
