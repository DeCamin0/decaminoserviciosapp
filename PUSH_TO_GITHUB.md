# Push Repository la GitHub

## Comenzi pentru a conecta repository-ul local la GitHub

Repository URL: `https://github.com/DeCamin0/decaminoserviciosapp.git`

### Rulează aceste comenzi în PowerShell:

```powershell
# 1. Navighează la folderul proiectului
cd c:\Users\DEEPGAMING\Desktop\decamino-web\decaminoserviciosapp

# 2. Adaugă remote-ul GitHub
git remote add origin https://github.com/DeCamin0/decaminoserviciosapp.git

# 3. Verifică că remote-ul a fost adăugat
git remote -v

# 4. Rename branch-ul la 'main' (GitHub folosește 'main' în loc de 'master')
git branch -M main

# 5. Push commit-urile la GitHub
git push -u origin main
```

### Dacă apare eroare "remote origin already exists":

```powershell
git remote remove origin
git remote add origin https://github.com/DeCamin0/decaminoserviciosapp.git
git branch -M main
git push -u origin main
```

### Dacă Git cere autentificare:

1. **Username**: `DeCamin0` (sau username-ul tău GitHub)
2. **Password**: Folosește un **Personal Access Token** (nu parola contului)

#### Cum creezi Personal Access Token:
1. GitHub → Settings (profilul tău) → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Bifează `repo` (full control of private repositories)
4. Click "Generate token"
5. **Copiază token-ul** (nu îl vei mai vedea!)
6. Folosește-l ca parolă când Git cere autentificare

### După push:

Refresh pagina repository-ului pe GitHub și ar trebui să vezi toate fișierele:
- `backend/`
- `frontend/`
- `README.md`
- `MIGRATION_PLAN.md`
- `.gitignore`
- etc.
