@echo off
chcp 65001 >nul
echo ========================================
echo    GitHub 推送助手
echo ========================================
echo.

echo 检测常见代理端口...
echo.

REM 尝试常见的代理端口
set "ports=7890 7891 10808 10809 1080 8080"
set "proxy_found=0"

for %%p in (%ports%) do (
    netstat -ano | findstr ":%%p" >nul 2>&1
    if !errorlevel! equ 0 (
        echo [✓] 检测到端口 %%p 可能有代理服务运行
        set /p use_proxy="是否使用端口 %%p 作为代理？(y/n): "
        if /i "!use_proxy!"=="y" (
            git config --global http.proxy http://127.0.0.1:%%p
            git config --global https.proxy http://127.0.0.1:%%p
            echo [✓] 已配置代理: http://127.0.0.1:%%p
            set "proxy_found=1"
            goto :push
        )
    )
)

:push
echo.
echo ========================================
echo 开始推送代码到 GitHub...
echo ========================================
echo.

git push -u origin main

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo [✓] 推送成功！
    echo ========================================
    echo.
    echo 下一步：
    echo 1. 访问 https://github.com/LHC-git/MerryChristmas/settings/pages
    echo 2. Source 选择: GitHub Actions
    echo 3. 等待部署完成
    echo 4. 访问: https://LHC-git.github.io/MerryChristmas/
    echo.
) else (
    echo.
    echo ========================================
    echo [×] 推送失败！
    echo ========================================
    echo.
    echo 请尝试以下方案：
    echo.
    echo 方案 1: 使用 GitHub Desktop
    echo   下载: https://desktop.github.com/
    echo.
    echo 方案 2: 手动配置代理
    echo   git config --global http.proxy http://127.0.0.1:你的代理端口
    echo.
    echo 方案 3: 网页上传
    echo   查看详细说明: PUSH_SOLUTIONS.md
    echo.
)

if %proxy_found% equ 1 (
    echo.
    set /p clear_proxy="是否清除代理配置？(y/n): "
    if /i "!clear_proxy!"=="y" (
        git config --global --unset http.proxy
        git config --global --unset https.proxy
        echo [✓] 已清除代理配置
    )
)

pause
