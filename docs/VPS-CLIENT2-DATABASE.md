# Creare bază de date Client 2 (HERA) pe VPS

Pași pentru a crea baza de date `hera_facility_db` pe serverul MySQL de pe VPS.

## 1. Conectare la VPS

```bash
ssh user@adresa-vps
```

## 2. Crearea bazei de date

### Variantă A: din fișierul SQL (recomandat)

Din directorul proiectului pe VPS (unde ai `backend/`):

```bash
cd /path/to/decaminoserviciosapp/backend
mysql -u root -p < scripts/create-db-client2.sql
```

Introdu parola utilizatorului `root` MySQL când ți se cere.

### Variantă B: manual în MySQL

```bash
mysql -u root -p
```

În consola MySQL:

```sql
CREATE DATABASE IF NOT EXISTS hera_facility_db
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
EXIT;
```

## 3. (Opțional) User dedicat pentru Client 2

Pentru securitate, poți folosi un user MySQL doar pentru `hera_facility_db`:

```bash
mysql -u root -p
```

```sql
CREATE USER IF NOT EXISTS 'hera_app'@'localhost' IDENTIFIED BY 'PAROLA_PUTERNICA_AICI';
GRANT ALL PRIVILEGES ON hera_facility_db.* TO 'hera_app'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Apoi în `.env` pe serverul Client 2 pune:
- `DB_USERNAME=hera_app`
- `DB_PASSWORD=PAROLA_PUTERNICA_AICI`
- `DB_NAME=hera_facility_db`

## 4. Crearea tabelelor cu Prisma (doar ce folosește aplicația)

Backend-ul folosește **Prisma**. După ce baza `hera_facility_db` există (goală), rulezi migrările Prisma – se creează **doar** tabelele din `schema.prisma` / migrări, fără tabele vechi sau inutile.

Pe mașina unde ai codul backend (sau pe VPS în directorul backend Client 2), cu `.env` setat pentru Client 2 (`DB_NAME=hera_facility_db`, `DB_HOST`, `DB_USERNAME`, `DB_PASSWORD`):

**Variantă recomandată** – scriptul construiește singur `DATABASE_URL` din `.env`:

```bash
cd backend
# .env cu DB_NAME=hera_facility_db și restul DB_*
node scripts/prisma-migrate-deploy.js
```

**Alternativ** – dacă ai deja `DATABASE_URL` în `.env`:

```bash
cd backend
npx prisma migrate deploy
```

- Migrările din `prisma/migrations/` se aplică pe baza `hera_facility_db`.
- Rezultat: **doar** tabelele și structura din schema Prisma, fără date și fără tabele în plus.

## 5. Verificare

```bash
mysql -u root -p -e "SHOW DATABASES LIKE 'hera_facility_db';"
```

Ar trebui să apară o linie: `hera_facility_db`.

## Rezumat variabile .env Client 2 (backend pe VPS)

| Variabilă     | Exemplu valoare   |
|---------------|-------------------|
| DB_HOST       | localhost         |
| DB_PORT       | 3306              |
| DB_NAME       | hera_facility_db  |
| DB_USERNAME   | root sau hera_app |
| DB_PASSWORD   | parola setată     |
| DATABASE_URL  | opțional; dacă lipsește, PrismaService o construiește din DB_*. Pentru `prisma migrate deploy` fie pui DATABASE_URL în .env, fie o exportezi înainte (vezi secțiunea 4). |

Fișierul complet: `backend/.env.client2.example` → copiat ca `.env` pe instanța backend Client 2.
