#!/bin/bash

# Script pentru a rula migrația NO_PUNCH
# Usage: ./run-no-punch-migration.sh

echo "🔄 Running NO_PUNCH enum migration..."

# Verifică dacă există variabila de mediu DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not set. Please set it in your .env file or export it."
    exit 1
fi

# Extrage informațiile de conexiune din DATABASE_URL
# Format: mysql://user:password@host:port/database
DB_URL=$(echo $DATABASE_URL | sed 's|mysql://||')
DB_USER=$(echo $DB_URL | cut -d':' -f1)
DB_PASS=$(echo $DB_URL | cut -d':' -f2 | cut -d'@' -f1)
DB_HOST=$(echo $DB_URL | cut -d'@' -f2 | cut -d':' -f1)
DB_PORT=$(echo $DB_URL | cut -d':' -f3 | cut -d'/' -f1)
DB_NAME=$(echo $DB_URL | cut -d'/' -f2)

echo "📝 Database: $DB_NAME on $DB_HOST:$DB_PORT"
echo "👤 User: $DB_USER"

# Rulează scriptul SQL
mysql -h "$DB_HOST" -P "${DB_PORT:-3306}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < backend/scripts/add-no-punch-enum.sql

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully!"
    echo "🔄 Regenerating Prisma Client..."
    cd backend && npx prisma generate
    echo "✅ Done!"
else
    echo "❌ Migration failed!"
    exit 1
fi

