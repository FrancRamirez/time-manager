$adb = "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe"

Write-Host "Limpiando el log anterior..."
& $adb logcat -c

Write-Host ""
Write-Host "Ahora abri la app y toca 'Continuar con Google'." -ForegroundColor Yellow
Write-Host "Esperá a que termine (con error o sin el), y volvé aca a apretar Enter." -ForegroundColor Yellow
Read-Host

Write-Host "Volcando TODO el log a login-log-full.txt ..."
& $adb logcat -d > login-log-full.txt

Write-Host "Listo. Ese archivo va a ser grande - buscá 'GOOGLE_LOGIN_ERROR' o 'timemanager'." -ForegroundColor Green