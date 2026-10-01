$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"

Write-Host "Limpiando el log anterior..."
& $adb logcat -c

Write-Host ""
Write-Host "Ahora abri la app y toca 'Continuar con Google'." -ForegroundColor Yellow
Write-Host "Esperá a que termine (con error o sin el), y volvé aca a apretar Enter." -ForegroundColor Yellow
Read-Host

Write-Host "Volcando el log a login-log.txt ..."
& $adb logcat -d | Select-String "ReactNativeJS|GoogleSignin|AndroidRuntime|FATAL" > login-log.txt

Write-Host "Listo. Revisá login-log.txt" -ForegroundColor Green
