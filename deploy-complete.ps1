git push origin main# 完整部署脚本 - 包含照片和手势功能
# 使用方法：.\deploy-complete.ps1

Write-Host "🎄 Christmas Tree Ultra - 完整部署脚本" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
Write-Host ""

# 检查目录
if (-not (Test-Path "package.json")) {
    Write-Host "❌ 错误：请在项目根目录运行此脚本！" -ForegroundColor Red
    exit 1
}

# 检查 Git
try {
    git --version | Out-Null
} catch {
    Write-Host "❌ 错误：未检测到 Git！" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Git 已安装" -ForegroundColor Green
Write-Host ""

# 验证关键文件
Write-Host "📋 检查关键文件..." -ForegroundColor Cyan
$criticalPaths = @(
    "public/photos",
    ".github/workflows/deploy.yml",
    "src/components/GestureController.tsx",
    "src/components/ui/PhotoManager.tsx"
)

$allExist = $true
foreach ($path in $criticalPaths) {
    if (Test-Path $path) {
        Write-Host "  ✅ $path" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $path 不存在！" -ForegroundColor Red
        $allExist = $false
    }
}

if (-not $allExist) {
    Write-Host ""
    Write-Host "❌ 缺少关键文件，请检查项目完整性！" -ForegroundColor Red
    exit 1
}

# 检查照片
$photoCount = (Get-ChildItem "public/photos" -Filter "*.jpg" -ErrorAction SilentlyContinue).Count
Write-Host ""
Write-Host "📸 检测到 $photoCount 张照片" -ForegroundColor Cyan

# 显示当前远程仓库
Write-Host ""
Write-Host "📡 当前远程仓库：" -ForegroundColor Cyan
$remote = git remote get-url origin 2>$null
if ($remote) {
    Write-Host "  $remote" -ForegroundColor Yellow
} else {
    Write-Host "  ⚠️  未配置远程仓库" -ForegroundColor Yellow
}

Write-Host ""
$confirm = Read-Host "确认推送到 GitHub？(y/n)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "❌ 已取消" -ForegroundColor Red
    exit 0
}

Write-Host ""
Write-Host "🚀 开始部署流程..." -ForegroundColor Cyan
Write-Host ""

# Step 1: 添加所有文件
Write-Host "[1/4] 添加文件..." -ForegroundColor Cyan
git add .

# 显示将要提交的文件统计
$status = git status --short
$fileCount = ($status | Measure-Object).Count
Write-Host "  准备提交 $fileCount 个文件" -ForegroundColor Yellow

# Step 2: 提交
Write-Host ""
Write-Host "[2/4] 提交更改..." -ForegroundColor Cyan
$needCommit = git status --porcelain
if ($needCommit) {
    $defaultMsg = "feat: 添加照片和手势交互功能 ($(Get-Date -Format 'yyyy-MM-dd HH:mm'))"
    Write-Host "  默认提交信息: $defaultMsg" -ForegroundColor Gray
    $customMsg = Read-Host "  自定义提交信息（直接回车使用默认）"
    
    if ([string]::IsNullOrWhiteSpace($customMsg)) {
        $commitMsg = $defaultMsg
    } else {
        $commitMsg = $customMsg
    }
    
    git commit -m "$commitMsg"
    Write-Host "  ✅ 已提交" -ForegroundColor Green
} else {
    Write-Host "  ✅ 没有需要提交的更改" -ForegroundColor Green
}

# Step 3: 确保在 main 分支
Write-Host ""
Write-Host "[3/4] 检查分支..." -ForegroundColor Cyan
$currentBranch = git branch --show-current
if ($currentBranch -ne "main") {
    git branch -M main
    Write-Host "  已切换到 main 分支" -ForegroundColor Yellow
}
Write-Host "  ✅ 当前在 main 分支" -ForegroundColor Green

# Step 4: 推送
Write-Host ""
Write-Host "[4/4] 推送到 GitHub..." -ForegroundColor Cyan
Write-Host ""

try {
    # 尝试推送
    git push -u origin main 2>&1 | ForEach-Object { 
        if ($_ -match "error|fatal") {
            Write-Host $_ -ForegroundColor Red
        } elseif ($_ -match "warning") {
            Write-Host $_ -ForegroundColor Yellow
        } else {
            Write-Host $_
        }
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "✅ 推送成功！" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "📌 后续步骤：" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "1. GitHub Actions 会自动开始构建" -ForegroundColor White
        Write-Host "   - 查看进度：$($remote -replace '\.git$', '')/actions" -ForegroundColor Gray
        Write-Host ""
        Write-Host "2. 等待 2-5 分钟，构建完成后访问你的网站" -ForegroundColor White
        Write-Host "   - 提示：手势功能需要 HTTPS 和摄像头权限" -ForegroundColor Gray
        Write-Host ""
        Write-Host "3. 确认 GitHub Pages 设置：" -ForegroundColor White
        Write-Host "   - Settings → Pages → Source: GitHub Actions" -ForegroundColor Gray
        Write-Host ""
    } else {
        throw "Push failed with exit code $LASTEXITCODE"
    }
    
} catch {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "❌ 推送失败" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 可能的解决方案：" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. 检查网络连接" -ForegroundColor White
    Write-Host "2. 如果需要代理，运行：" -ForegroundColor White
    Write-Host "   git config --global http.proxy http://127.0.0.1:7890" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. 检查 GitHub 认证：" -ForegroundColor White
    Write-Host "   - 使用 GitHub Desktop" -ForegroundColor Gray
    Write-Host "   - 或配置 Personal Access Token" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "🎉 部署完成！祝圣诞快乐！" -ForegroundColor Green
Write-Host ""
