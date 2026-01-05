# PowerShell script pentru a rula migrația NO_PUNCH pe Windows
# Usage: .\run-no-punch-migration.ps1

Write-Host "🔄 Running NO_PUNCH enum migration..." -ForegroundColor Cyan

# Verifică dacă există variabila de mediu DATABASE_URL
if (-not $env:DATABASE_URL) {
    Write-Host "❌ DATABASE_URL not set. Please set it in your .env file." -ForegroundColor Red
    exit 1
}

# Extrage informațiile de conexiune din DATABASE_URL
# Format: mysql://user:password@host:port/database
$dbUrl = $env:DATABASE_URL -replace "mysql://", ""
$parts = $dbUrl -split "@"
$userPass = $parts[0] -split ":"
$dbUser = $userPass[0]
$dbPass = $userPass[1]
$hostDb = $parts[1] -split "/"
$hostPort = $hostDb[0] -split ":"
$dbHost = $hostPort[0]
$dbPort = if ($hostPort.Length -gt 1) { $hostPort[1] } else { "3306" }
$dbName = $hostDb[1]

Write-Host "📝 Database: $dbName on ${dbHost}:${dbPort}" -ForegroundColor Yellow
Write-Host "👤 User: $dbUser" -ForegroundColor Yellow

# Construiește comanda mysql
$sqlFile = Join-Path $PSScriptRoot "add-no-punch-enum.sql"
$sqlContent = Get-Content $sqlFile -Raw

# Rulează scriptul SQL folosind mysql (dacă e instalat) sau poți folosi Prisma
Write-Host "🔄 Executing SQL migration..." -ForegroundColor Cyan

# Alternativă: folosește Prisma pentru a rula migrația
Write-Host "🔄 Using Prisma migrate..." -ForegroundColor Cyan
Set-Location (Join-Path $PSScriptRoot "..")
npx prisma migrate deploy

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Migration completed successfully!" -ForegroundColor Green
    Write-Host "🔄 Regenerating Prisma Client..." -ForegroundColor Cyan
    npx prisma generate
    Write-Host "✅ Done!" -ForegroundColor Green
} else {
    Write-Host "❌ Migration failed!" -ForegroundColor Red
    exit 1
}

