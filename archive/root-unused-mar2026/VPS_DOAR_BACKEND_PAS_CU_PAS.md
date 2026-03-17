# VPS: Păstrăm doar backend – pas cu pas

Rulezi comenzile **pe VPS** (SSH), una câte una. După fiecare pas verifici că nu ai erori.

---

## Pas 1: Vezi unde e proiectul și cum rulează backend-ul

```bash
# Unde e proiectul? (înlocuiește cu path-ul tău real dacă e altul)
cd /opt/decaminoserviciosapp
# sau: cd /home/tuusuario/decaminoserviciosapp
pwd
ls -la
ls backend
```

**Notează:** path-ul complet (ex: `/opt/decaminoserviciosapp`). Îl vom numi `PROIECT_VECHI`.

```bash
# Cum rulează backend-ul? PM2 sau systemd?
pm2 list
```

Dacă vezi un proces (ex. `decamino-api` sau `main`), **notează numele**.  
Dacă nu ai PM2:

```bash
systemctl list-units --type=service | grep -i decamino
# sau
systemctl list-units --type=service | grep -i node
```

**Opțional:** verifică că backend-ul răspunde:

```bash
curl -s http://localhost:3000/api/health
# sau portul tău (3001, etc.)
```

---

## Pas 2: Creezi folderul nou (doar pentru backend)

Alege un path unde va sta doar backend-ul, de ex. `/opt/decamino-backend`:

```bash
sudo mkdir -p /opt/decamino-backend
sudo chown $(whoami):$(whoami) /opt/decamino-backend
ls -la /opt/decamino-backend
```

Dacă ai eroare de permisiuni, folosești user-ul cu care rulează app-ul (ex. `www-data` sau user-ul tău).

---

## Pas 3: Copiezi doar conținutul din `backend/`

**Înlocuiește** `PROIECT_VECHI` cu path-ul de la Pas 1 (ex: `/opt/decaminoserviciosapp`):

```bash
PROIECT_VECHI=/opt/decaminoserviciosapp
cp -a "$PROIECT_VECHI/backend/"* /opt/decamino-backend/
```

Verifici că ai tot ce trebuie:

```bash
ls -la /opt/decamino-backend
# Ar trebui să vezi: package.json, src/, prisma/, dist/ (dacă exista), etc.
```

Copiezi și `.env` (dacă e în backend):

```bash
cp "$PROIECT_VECHI/backend/.env" /opt/decamino-backend/ 2>/dev/null || echo "Nu există .env în backend, îl configurezi manual"
```

---

## Pas 4: Instalezi dependențe și build în noul folder

```bash
cd /opt/decamino-backend
npm ci
npm run build
```

Dacă `npm run build` e altul (ex. `nest build`), folosești comanda pe care o ai în `package.json` pentru build. La final ar trebui să existe `dist/` cu `main.js` (sau echivalent).

---

## Pas 5: Oprești backend-ul vechi

**Dacă folosești PM2:**

```bash
pm2 stop all
# sau: pm2 stop numele-procesului
pm2 list
```

**Dacă folosești systemd:**

```bash
sudo systemctl stop decamino-api
# sau numele serviciului tău
sudo systemctl status decamino-api
```

---

## Pas 6: Pornești backend-ul din noul folder

**Cu PM2:**

```bash
cd /opt/decamino-backend
pm2 start dist/main.js --name decamino-api
# SAU dacă pornești cu npm:
# pm2 start npm --name decamino-api -- run start:prod
pm2 save
pm2 list
pm2 logs decamino-api --lines 30
```

**Cu systemd:** editezi serviciul:

```bash
sudo nano /etc/systemd/system/decamino-api.service
```

Pui:
- `WorkingDirectory=/opt/decamino-backend`
- `ExecStart=` să fie ce ai acum, dar din `/opt/decamino-backend` (ex: `node dist/main.js` sau `npm run start:prod`).

Apoi:

```bash
sudo systemctl daemon-reload
sudo systemctl start decamino-api
sudo systemctl status decamino-api
```

---

## Pas 7: Verifici că totul merge

- În browser: deschizi aplicația (frontend) și faci câteva acțiuni (login, o pagină).
- Pe VPS:

```bash
curl -s http://localhost:3000/api/health
# sau portul tău
pm2 logs decamino-api --lines 20
```

Dacă totul e ok, treci la pasul următor.

---

## Pas 8: Ștergi proiectul vechi (full)

**Doar după ce ești sigur că backend-ul din `/opt/decamino-backend` funcționează.**

Backup opțional:

```bash
sudo tar -czvf /root/decamino-full-backup-$(date +%Y%m%d).tar.gz /opt/decaminoserviciosapp
```

Ștergere:

```bash
sudo rm -rf /opt/decaminoserviciosapp
```

Verifici:

```bash
ls /opt
# Ar trebui să vezi doar decamino-backend (și altele), fără decaminoserviciosapp.
```

---

## Rezumat

| Pas | Ce faci |
|-----|--------|
| 1 | Vezi path proiect + cum rulează backend (PM2/systemd) |
| 2 | Creezi `/opt/decamino-backend` |
| 3 | Copiezi `backend/*` + `.env` în `/opt/decamino-backend` |
| 4 | `npm ci` + `npm run build` în noul folder |
| 5 | Oprești procesul vechi |
| 6 | Pornești backend din `/opt/decamino-backend` |
| 7 | Verifici în browser + curl/logs |
| 8 | Ștergi proiectul vechi |

După asta pe VPS rămâne doar backend-ul. Pentru actualizări viitoare: faci `git pull` într-un clone (sau copiezi doar `backend/` din repo) și refaci pasul 3–4–6 din noul cod.
