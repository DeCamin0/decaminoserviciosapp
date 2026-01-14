@echo off
echo 🚀 Iniciando deploy para producción...

REM 1. Construir la aplicación
echo 🔨 Construyendo aplicación...
call npm run build

REM 2. Verificar que el build se completó
if not exist "dist" (
    echo ❌ Error: Build falló
    pause
    exit /b 1
)

echo ✅ Build completado exitosamente

REM 3. Mostrar configuración de URLs
echo.
echo 📋 Configuración de URLs:
echo    - Login: https://n8n.decaminoservicios.com/webhook/v1/aec36db4-58d4-4175-8429-84d1c487e142
echo    - AutoFirma: https://n8n.decaminoservicios.com/webhook/v1/b066b1f7-cc6e-4b9e-a86f-7202a86acab4
echo    - Documentos: https://n8n.decaminoservicios.com/webhook/171d8236-6ef1-4b97-8605-096476bc1d8b

REM 4. Instrucciones para CORS en n8n
echo.
echo ⚠️  IMPORTANTE: Configurar CORS en n8n
echo    En cada workflow de n8n, agregar estos headers de respuesta:
echo    Access-Control-Allow-Origin: https://decaminoservicios.com
echo    Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
echo    Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With

echo.
echo ✅ Deploy listo! Subir archivos de la carpeta 'dist/' al servidor web
pause
