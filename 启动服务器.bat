@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 充电桩雷达 - API 服务器
echo ========================================
echo   充电桩雷达 Mock API 服务器
echo   端口: 3000
echo   数据库: test.db (SQLite)
echo ========================================
echo.
echo 正在启动，请勿关闭此窗口...
echo 关闭此窗口即停止服务。
echo.
python server\mock_api.py
pause
