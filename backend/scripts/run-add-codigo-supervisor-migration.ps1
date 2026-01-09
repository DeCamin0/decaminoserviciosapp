# Script PowerShell pentru rularea migrației SQL - Adăugare codigo_supervisor
# Rulează: .\scripts\run-add-codigo-supervisor-migration.ps1

$sqlFile = "prisma\migrations\20260109150000_add_codigo_supervisor_to_inspecciones\migration.sql"
$host = "217.154.102.115"
$user = "facturacion_user"
$database = "decamino_db"

Write-Host "📋 Running migration: Add codigo_supervisor to InspeccionesDocumentos" -ForegroundColor Cyan
Write-Host "🔗 Connecting to: $host" -ForegroundColor Yellow
Write-Host "📁 Database: $database" -ForegroundColor Yellow
Write-Host ""

# Verifică dacă fișierul există
if (-not (Test-Path $sqlFile)) {
    Write-Host "❌ SQL file not found: $sqlFile" -ForegroundColor Red
    exit 1
}

# Citește conținutul SQL
$sqlContent = Get-Content $sqlFile -Raw

Write-Host "📄 SQL Content:" -ForegroundColor Cyan
Write-Host $sqlContent -ForegroundColor Gray
Write-Host ""

# Verifică dacă mysql este în PATH
$mysqlPath = Get-Command mysql -ErrorAction SilentlyContinue

if ($mysqlPath) {
    Write-Host "✅ MySQL found at: $($mysqlPath.Path)" -ForegroundColor Green
    Write-Host "🚀 Running migration..." -ForegroundColor Yellow
    Write-Host ""
    
    # Rulează migrația
    $sqlContent | & mysql -h $host -u $user -p $database
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Migration completed successfully!" -ForegroundColor Green
        Write-Host "✅ Column 'codigo_supervisor' added to InspeccionesDocumentos table" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "❌ Migration failed with exit code: $LASTEXITCODE" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "❌ MySQL not found in PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "📝 Please run the SQL manually:" -ForegroundColor Yellow
    Write-Host "   1. Open MySQL client (HeidiSQL, phpMyAdmin, etc.)" -ForegroundColor Yellow
    Write-Host "   2. Connect to: $host" -ForegroundColor Yellow
    Write-Host "   3. Select database: $database" -ForegroundColor Yellow
    Write-Host "   4. Run the following SQL:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host $sqlContent -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Or add MySQL to PATH and try again." -ForegroundColor Yellow
}
