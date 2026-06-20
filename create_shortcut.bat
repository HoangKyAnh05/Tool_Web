@echo off
title DevBlueprint AI - Create Desktop Shortcut
color 0A

echo ===================================================
echo             CREATE DESKTOP SHORTCUT
echo ===================================================
echo.
echo This script will create a shortcut for DevBlueprint AI on your Desktop.
echo The app will launch directly, with NO terminal window showing.
echo.

powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\DevBlueprint AI.lnk'); $Shortcut.TargetPath = 'd:\code_tino_19_4\Code_Tool_Python\Tool_Web\node_modules\electron\dist\electron.exe'; $Shortcut.Arguments = '.'; $Shortcut.WorkingDirectory = 'd:\code_tino_19_4\Code_Tool_Python\Tool_Web'; $Shortcut.Description = 'Launch DevBlueprint AI App'; $Shortcut.Save()"

echo.
echo [SUCCESS] Shortcut 'DevBlueprint AI' created on Desktop successfully!
echo You can now close this window and double-click the shortcut on your desktop.
echo.
pause
