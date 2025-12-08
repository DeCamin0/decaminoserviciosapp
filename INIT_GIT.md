# Git Initialization Steps

## Pas cu pas pentru inițializarea Git

Rulează aceste comenzi în terminal, una câte una:

### 1. Verifică dacă Git este instalat
```powershell
git --version
```

### 2. Navighează la folderul proiectului
```powershell
cd c:\Users\DEEPGAMING\Desktop\decamino-web\decaminoserviciosapp
```

### 3. Inițializează Git
```powershell
git init
```

### 4. Configurează user (local pentru acest repo)
```powershell
git config user.name "DeCamino Dev"
git config user.email "dev@decaminoservicios.local"
```

SAU configurează global (pentru toate repo-urile):
```powershell
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

### 5. Adaugă toate fișierele
```powershell
git add .
```

### 6. Verifică ce fișiere vor fi adăugate
```powershell
git status
```

### 7. Creează commit-ul inițial
```powershell
git commit -m "Initial commit: monorepo setup with NestJS backend and React frontend"
```

### 8. Verifică că totul a funcționat
```powershell
git log --oneline
git status
```

## Dacă apare eroare la commit

Dacă vezi eroarea: `Author identity unknown`, înseamnă că trebuie să configurezi user.name și user.email (pasul 4).

## Dacă vrei să ignori anumite fișiere

Fișierul `.gitignore` este deja creat și include:
- `node_modules/`
- `dist/`, `build/`
- `.env` files
- etc.
