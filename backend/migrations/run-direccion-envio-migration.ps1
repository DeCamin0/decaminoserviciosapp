# Script PowerShell pentru rularea migrației SQL - Direccion de Envio
# Rulează: .\run-direccion-envio-migration.ps1

$sqlFile = "migrations/add_direccion_envio_to_pedidos.sql"
$dbHost = "217.154.102.115"
$user = "facturacion_user"
$database = "decamino_db"

Write-Host "Running migration: $sqlFile" -ForegroundColor Cyan
Write-Host "Connecting to: $dbHost" -ForegroundColor Yellow

# Citește conținutul SQL
$sqlContent = Get-Content $sqlFile -Raw

# Construiește comanda MySQL
# Notă: Trebuie să ai MySQL în PATH sau să specifici calea completă
# Exemplu: C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe

# Verifică dacă mysql este în PATH
$mysqlPath = Get-Command mysql -ErrorAction SilentlyContinue

if ($mysqlPath) {
    Write-Host "MySQL found at: $($mysqlPath.Path)" -ForegroundColor Green
    
    # Rulează migrația
    $sqlContent | & mysql -h $dbHost -u $user -p $database
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Migration completed successfully!" -ForegroundColor Green
        Write-Host "Added columns: direccion_envio, codigo_postal_envio, localidad_envio, provincia_envio" -ForegroundColor Green
    } else {
        Write-Host "Migration failed with exit code: $LASTEXITCODE" -ForegroundColor Red
    }
} else {
    Write-Host "MySQL not found in PATH" -ForegroundColor Red
    Write-Host "Please run the SQL manually:" -ForegroundColor Yellow
    Write-Host "   1. Open MySQL client (HeidiSQL, phpMyAdmin, etc.)" -ForegroundColor Yellow
    Write-Host "   2. Connect to: $dbHost" -ForegroundColor Yellow
    Write-Host "   3. Select database: $database" -ForegroundColor Yellow
    Write-Host "   4. Run the contents of: $sqlFile" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Or add MySQL to PATH and try again." -ForegroundColor Yellow
}
