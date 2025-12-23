# GitHub Pages 快速部署脚本
# 使用方法：在 PowerShell 中运行 .\deploy-github.ps1

Write-Host "🎄 Christmas Tree Ultra - GitHub Pages 部署助手" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""

# 检查是否在正确的目录
if (-not (Test-Path "package.json")) {
    Write-Host "❌ 错误：请在项目根目录运行此脚本！" -ForegroundColor Red
    exit 1
}

# 检查 Git 是否安装
try {
    git --version | Out-Null
} catch {
    Write-Host "❌ 错误：未检测到 Git，请先安装 Git！" -ForegroundColor Red
    Write-Host "下载地址：https://git-scm.com/download/win" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Git 已安装" -ForegroundColor Green

# 获取用户输入
Write-Host ""
Write-Host "请输入你的 GitHub 信息：" -ForegroundColor Cyan
$username = Read-Host "GitHub 用户名"
$repoName = Read-Host "仓库名称（例如：christmas-tree）"

if ([string]::IsNullOrWhiteSpace($username) -or [string]::IsNullOrWhiteSpace($repoName)) {
    Write-Host "❌ 用户名和仓库名不能为空！" -ForegroundColor Red
    exit 1
}

$remoteUrl = "https://github.com/$username/$repoName.git"

Write-Host ""
Write-Host "将要推送到：$remoteUrl" -ForegroundColor Yellow
$confirm = Read-Host "确认继续？(y/n)"

if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "❌ 已取消部署" -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "📦 开始部署流程..." -ForegroundColor Cyan

# Step 1: 检查是否有未提交的更改
Write-Host ""
Write-Host "[1/5] 检查文件状态..." -ForegroundColor Cyan
git add .
$status = git status --porcelain
if ($status) {
    Write-Host "发现未提交的更改，准备提交..." -ForegroundColor Yellow
    $commitMsg = Read-Host "请输入提交信息（直接回车使用默认信息）"
    if ([string]::IsNullOrWhiteSpace($commitMsg)) {
        $commitMsg = "Update: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    }
    git commit -m "$commitMsg"
    Write-Host "✅ 已提交更改" -ForegroundColor Green
} else {
    Write-Host "✅ 没有需要提交的更改" -ForegroundColor Green
}

# Step 2: 检查远程仓库
Write-Host ""
Write-Host "[2/5] 配置远程仓库..." -ForegroundColor Cyan
$existingRemote = git remote get-url origin 2>$null
if ($existingRemote) {
    Write-Host "检测到已有远程仓库：$existingRemote" -ForegroundColor Yellow
    $replace = Read-Host "是否替换为新的仓库地址？(y/n)"
    if ($replace -eq "y" -or $replace -eq "Y") {
        git remote remove origin
        git remote add origin $remoteUrl
        Write-Host "✅ 已更新远程仓库地址" -ForegroundColor Green
    }
} else {
    git remote add origin $remoteUrl
    Write-Host "✅ 已添加远程仓库" -ForegroundColor Green
}

# Step 3: 确保在 main 分支
Write-Host ""
Write-Host "[3/5] 检查分支..." -ForegroundColor Cyan
$currentBranch = git branch --show-current
if ($currentBranch -ne "main") {
    Write-Host "当前分支：$currentBranch，切换到 main 分支..." -ForegroundColor Yellow
    git branch -M main
}
Write-Host "✅ 当前在 main 分支" -ForegroundColor Green

# Step 4: 推送代码
Write-Host ""
Write-Host "[4/5] 推送代码到 GitHub..." -ForegroundColor Cyan
Write-Host "⚠️  如果是首次推送，可能需要输入 GitHub 用户名和密码（或 Personal Access Token）" -ForegroundColor Yellow

try {
    git push -u origin main 2>&1 | ForEach-Object { Write-Host $_ }
    Write-Host "✅ 代码推送成功！" -ForegroundColor Green
} catch {
    Write-Host "❌ 推送失败！" -ForegroundColor Red
    Write-Host "可能的原因：" -ForegroundColor Yellow
    Write-Host "1. 仓库不存在，请先在 GitHub 创建仓库" -ForegroundColor Yellow
    Write-Host "2. 权限不足，请检查登录凭证" -ForegroundColor Yellow
    Write-Host "3. 网络连接问题" -ForegroundColor Yellow
    exit 1
}

# Step 5: 完成提示
Write-Host ""
Write-Host "[5/5] 部署配置完成！" -ForegroundColor Cyan
Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "✨ 接下来的步骤：" -ForegroundColor Green
Write-Host ""
Write-Host "1. 访问你的 GitHub 仓库：" -ForegroundColor Cyan
Write-Host "   https://github.com/$username/$repoName" -ForegroundColor White
Write-Host ""
Write-Host "2. 进入 Settings > Pages" -ForegroundColor Cyan
Write-Host ""
Write-Host "3. 在 'Build and deployment' 部分：" -ForegroundColor Cyan
Write-Host "   Source 选择：GitHub Actions" -ForegroundColor White
Write-Host ""
Write-Host "4. 等待 2-5 分钟，访问你的网站：" -ForegroundColor Cyan
Write-Host "   https://$username.github.io/$repoName/" -ForegroundColor White
Write-Host ""
Write-Host "5. 在 Actions 标签页可以查看部署进度" -ForegroundColor Cyan
Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "📖 详细说明请查看：GITHUB_PAGES_SETUP.md" -ForegroundColor Yellow
Write-Host ""
Write-Host "🎄 祝部署顺利！" -ForegroundColor Green

# 询问是否打开浏览器
Write-Host ""
$openBrowser = Read-Host "是否打开 GitHub 仓库页面？(y/n)"
if ($openBrowser -eq "y" -or $openBrowser -eq "Y") {
    Start-Process "https://github.com/$username/$repoName"
}
