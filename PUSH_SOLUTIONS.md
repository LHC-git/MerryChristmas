# 🔧 GitHub 推送问题解决方案

## 当前问题
无法连接到 GitHub 的 443 端口（HTTPS），导致 `git push` 失败。

---

## 解决方案（按推荐顺序）

### 方案 1：配置 Git 使用代理（如果你有代理软件）

如果你的电脑上有代理软件（如 Clash、V2Ray 等），找到代理端口号（通常是 7890、7891、10809 等），然后运行：

```powershell
# 配置 Git 使用 HTTP 代理（替换端口号为你的实际端口）
git config --global http.proxy http://127.0.0.1:7890
git config --global https.proxy http://127.0.0.1:7890

# 然后重试推送
git push -u origin main
```

**取消代理配置：**
```powershell
git config --global --unset http.proxy
git config --global --unset https.proxy
```

---

### 方案 2：通过 GitHub Desktop 推送（推荐 - 最简单）

1. 下载并安装 GitHub Desktop：https://desktop.github.com/
2. 打开 GitHub Desktop，登录你的 GitHub 账号
3. 点击 File > Add Local Repository
4. 选择项目目录：`C:\Users\LENOVO\Desktop\tree\tree\Christmas-Tree-Ultra`
5. 点击 "Publish repository"，选择 "MerryChristmas" 作为仓库名
6. 点击 Publish

GitHub Desktop 会自动处理网络连接问题。

---

### 方案 3：手动打包上传到 GitHub 网页

#### 步骤 1：创建 .zip 文件

在项目目录右键 > 发送到 > 压缩(zipped)文件夹

或使用 PowerShell：
```powershell
cd C:\Users\LENOVO\Desktop\tree\tree\Christmas-Tree-Ultra
Compress-Archive -Path * -DestinationPath ..\MerryChristmas.zip -Force
```

#### 步骤 2：上传到 GitHub

1. 访问 https://github.com/LHC-git/MerryChristmas
2. 如果仓库不存在，先创建仓库（仓库名：MerryChristmas，必须是 Public）
3. 点击 "uploading an existing file"
4. 解压 zip 文件，选择所有文件拖拽上传
5. 填写提交信息，点击 "Commit changes"

---

### 方案 4：修改 Git 配置文件（修改连接超时时间）

```powershell
git config --global http.postBuffer 524288000
git config --global http.lowSpeedLimit 0
git config --global http.lowSpeedTime 999999

# 重试推送
git push -u origin main
```

---

### 方案 5：使用 SSH 方式推送（需要配置 SSH 密钥）

#### 生成 SSH 密钥：
```powershell
ssh-keygen -t ed25519 -C "your.email@example.com"
```
按回车使用默认路径，设置密码（可选）

#### 添加 SSH 密钥到 GitHub：
1. 复制公钥内容：
```powershell
Get-Content $env:USERPROFILE\.ssh\id_ed25519.pub | clip
```

2. 访问 https://github.com/settings/ssh/new
3. 粘贴公钥，点击 "Add SSH key"

#### 切换到 SSH URL：
```powershell
git remote set-url origin git@github.com:LHC-git/MerryChristmas.git
git push -u origin main
```

---

### 方案 6：直接部署到本地服务器（无需 GitHub）

构建项目并使用本地服务器：

```powershell
# 构建项目
npm run build

# 使用 Python 启动服务器
cd dist
python -m http.server 8080
```

访问 http://localhost:8080

---

## 推荐操作流程

1. **最简单**：使用 **方案 2（GitHub Desktop）**
2. **有代理**：使用 **方案 1（配置代理）**
3. **无法推送**：使用 **方案 3（网页上传）**
4. **本地查看**：使用 **方案 6（本地服务器）**

---

## 启用 GitHub Pages

无论使用哪种方式上传代码，最后都需要启用 Pages：

1. 访问 https://github.com/LHC-git/MerryChristmas/settings/pages
2. Source 选择：**GitHub Actions**
3. 等待 2-5 分钟自动部署
4. 访问：https://LHC-git.github.io/MerryChristmas/

---

## 需要帮助？

如果以上方案都无法解决，可以：
1. 检查系统代理设置
2. 尝试使用手机热点
3. 联系网络管理员
