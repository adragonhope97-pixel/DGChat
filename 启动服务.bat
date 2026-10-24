@echo off
chcp 65001 >nul
title DGChat 服务
cd /d "%~dp0"
echo ============================================
echo   DGChat 服务启动中...
echo   电脑浏览器访问:  http://localhost:3000
echo   手机访问:        http://<电脑局域网IP>:3000
echo   （查看 IP：另开终端输入 ipconfig）
echo   关闭本窗口即停止服务
echo ============================================
node server/server.js
pause
