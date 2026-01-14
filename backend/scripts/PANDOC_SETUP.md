# 📄 Setup Pandoc pentru Generare PDF

## Instalare Pandoc

### Windows

**Opțiunea 1: Cu winget (recomandat)**
```powershell
winget install JohnMacFarlane.Pandoc
```

**Opțiunea 2: Cu Chocolatey**
```powershell
choco install pandoc
```

**Opțiunea 3: Download manual**
1. Descarcă de la: https://pandoc.org/installing.html
2. Instalează executabilul

### Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install pandoc
```

### macOS
```bash
brew install pandoc
```

## Instalare PDF Engine

Pandoc necesită un PDF engine pentru a genera PDF-uri. Opțiuni:

### Opțiunea 1: XeLaTeX (Recomandat - suport fonturi și UTF-8)

**Windows:**
- Descarcă MiKTeX: https://miktex.org/download
- Sau TeX Live: https://www.tug.org/texlive/

**Linux:**
```bash
sudo apt-get install texlive-xetex texlive-fonts-recommended
```

**macOS:**
```bash
brew install --cask mactex
```

### Opțiunea 2: wkhtmltopdf (Alternativă mai simplă)

**Windows:**
- Descarcă de la: https://wkhtmltopdf.org/downloads.html
- Instalează și adaugă la PATH

**Linux:**
```bash
sudo apt-get install wkhtmltopdf
```

**macOS:**
```bash
brew install wkhtmltopdf
```

## Utilizare

### Generare PDF cu Pandoc
```bash
cd backend
npm run pdf:manual-empleados-pandoc
```

Sau direct:
```bash
cd backend
node scripts/generate-manual-empleados-pdf-pandoc.js
```

## Configurare

### Schimbarea PDF Engine

Dacă nu ai XeLaTeX, poți schimba engine-ul în `generate-manual-empleados-pdf-pandoc.js`:

```javascript
// Pentru pdflatex (mai simplu, dar fără suport fonturi avansate)
'--pdf-engine=pdflatex'

// Pentru wkhtmltopdf (foarte simplu, dar limitat)
'--pdf-engine=wkhtmltopdf'
```

### Personalizare Stiluri

Editează `pandoc-header.tex` pentru a personaliza:
- Header și footer
- Logo
- Culori
- Fonturi
- Margini

## Avantaje Pandoc

✅ **Foarte stabil** - standardul industriei  
✅ **Suport complet Markdown** - tabele, cod, imagini  
✅ **Stiluri personalizate** - LaTeX/CSS  
✅ **Ideal pentru automatizare** - perfect pentru server  
✅ **Fără pagini goale** - gestionează corect paginarea  
✅ **Calitate profesională** - output de tipografie  

## Troubleshooting

### Eroare: "xelatex not found"
- Instalează MiKTeX sau TeX Live
- Sau schimbă la `--pdf-engine=wkhtmltopdf`

### Eroare: "wkhtmltopdf not found"
- Instalează wkhtmltopdf
- Sau folosește `--pdf-engine=xelatex`

### PDF-ul nu are logo
- Verifică că `logo.png` există în `frontend/public/`
- Logo-ul trebuie să fie accesibil pentru LaTeX

### Fonturi nu funcționează
- XeLaTeX suportă fonturi personalizate
- Pentru pdflatex, folosește doar fonturi standard
