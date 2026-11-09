' 鲸忆 一键安装（Windows 双击这个就行）
@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo 没找到 node。先装 Node.js 20 以上：https://nodejs.org
  echo.
  pause
  exit /b 1
)
node "%~dp0scripts\install.mjs"
echo.
echo 装完了。上面最后几行写了下一步（照 docs\接入钩子.md 挂三个钩子）。
pause
