# Conectare Repository Local la GitHub

## Pași pentru a conecta repository-ul local la GitHub

### 1. Creează repository-ul pe GitHub

1. Mergi pe [GitHub.com](https://github.com) și loghează-te
2. Click pe butonul verde **"Create repository"** sau pe **"+"** din colțul dreapta sus → "New repository"
3. Completează:
   - **Repository name**: `decaminoserviciosapp` (sau alt nume preferat)
   - **Description**: "DeCamino Servicios - Monorepo with React frontend and NestJS backend"
   - **Visibility**: Public sau Private (după preferință)
   - **NU** bifa "Add a README file" (avem deja unul)
   - **NU** adăuga .gitignore sau license (avem deja)
4. Click **"Create repository"**

### 2. Copiază URL-ul repository-ului

După ce creezi repository-ul, GitHub va afișa o pagină cu instrucțiuni. Vei vedea un URL de tipul:
- `https://github.com/TU_USERNAME/decaminoserviciosapp.git` (HTTPS)
- SAU `git@github.com:TU_USERNAME/decaminoserviciosapp.git` (SSH)

### 3. Conectează repository-ul local la GitHub

Rulează aceste comenzi în terminal (înlocuiește URL-ul cu cel tău):

#### Opțiunea 1: HTTPS (mai simplu, necesită autentificare)
```powershell
cd c:\Users\DEEPGAMING\Desktop\decamino-web\decaminoserviciosapp

# Adaugă remote-ul GitHub
git remote add origin https://github.com/TU_USERNAME/decaminoserviciosapp.git

# Verifică că remote-ul a fost adăugat
git remote -v

# Rename branch-ul la 'main' (dacă GitHub folosește 'main' în loc de 'master')
git branch -M main

# Push commit-urile la GitHub
git push -u origin main
```

#### Opțiunea 2: SSH (dacă ai SSH keys configurate)
```powershell
cd c:\Users\DEEPGAMING\Desktop\decamino-web\decaminoserviciosapp

git remote add origin git@github.com:TU_USERNAME/decaminoserviciosapp.git
git branch -M main
git push -u origin main
```

### 4. Autentificare (dacă folosești HTTPS)

Dacă folosești HTTPS, GitHub va cere autentificare:
- **Username**: username-ul tău GitHub
- **Password**: Folosește un **Personal Access Token** (nu parola contului)

#### Cum creezi Personal Access Token:
1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Bifează `repo` (full control of private repositories)
4. Click "Generate token"
5. **Copiază token-ul** (nu îl vei mai vedea!)
6. Folosește-l ca parolă când Git cere autentificare

### 5. Verificare

După push, verifică pe GitHub că fișierele au fost încărcate:
- Refresh pagina repository-ului pe GitHub
- Ar trebui să vezi toate fișierele: `backend/`, `frontend/`, `README.md`, etc.

## Comenzi utile după conectare

```powershell
# Vezi remote-urile configurate
git remote -v

# Push modificări noi
git push

# Pull modificări de pe GitHub
git pull

# Vezi status
git status
```

## Dacă apare eroare

### "remote origin already exists"
```powershell
git remote remove origin
git remote add origin URL_TU_REPOSITORY
```

### "failed to push some refs"
```powershell
# Dacă GitHub are commit-uri pe care tu nu le ai (ex: README creat automat)
git pull origin main --allow-unrelated-histories
git push -u origin main
```
