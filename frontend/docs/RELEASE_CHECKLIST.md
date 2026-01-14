# 📋 RELEASE CHECKLIST - De Camino Android

## 🎯 Pași finali pentru lansarea aplicației Android

### 1. ✅ Verifică PWA build
```bash
npm run build
```
- Verifică că build-ul se completează fără erori
- Testează aplicația pe `https://app.decaminoservicios.com`

### 2. 🌐 Deploy pe hosting
- Deploy build-ul pe `https://app.decaminoservicios.com`
- Verifică că toate funcționalitățile merg corect
- Testează cameră și geolocația în browser

### 3. 📱 Sincronizează Capacitor
```bash
npx cap copy
npx cap sync
```
- Verifică că toate pluginurile sunt sincronizate
- Confirmă că `capacitor.config.ts` are configurația corectă

### 4. 🏗️ Deschide Android Studio
```bash
npx cap open android
```
- Android Studio se deschide automat
- Așteaptă să se sincronizeze proiectul

### 5. 📊 Setează versiunea
În `android/app/build.gradle`:
```gradle
android {
    defaultConfig {
        versionCode 1
        versionName "1.0.0"
    }
}
```

### 6. 🔐 Generează keystore (o singură dată)
```bash
keytool -genkey -v -keystore decamino-release-key.keystore -alias decamino -keyalg RSA -keysize 2048 -validity 10000
```
- **PĂSTREAZĂ ÎN SIGURANȚĂ** keystore-ul și parola!
- Adaugă în `android/gradle.properties`:
```properties
DECAMINO_UPLOAD_STORE_FILE=decamino-release-key.keystore
DECAMINO_UPLOAD_KEY_ALIAS=decamino
DECAMINO_UPLOAD_STORE_PASSWORD=your_password
DECAMINO_UPLOAD_KEY_PASSWORD=your_password
```

### 7. 📦 Generează AAB pentru Play Store
În Android Studio:
1. Build > Generate Signed Bundle / APK
2. Selectează "Android App Bundle"
3. Alege keystore-ul generat
4. AAB-ul se generează în `android/app/build/outputs/bundle/release/`

### 8. 🧪 (Opțional) Generează APK pentru test
1. Build > Build Bundle(s) / APK(s) > Build APK(s)
2. APK-ul se generează în `android/app/build/outputs/apk/debug/`
3. Instalează pe dispozitiv pentru testare

### 9. 🏪 Play Console - Completează informații
- **Data Safety**: Completează cu informațiile din `DATA_SAFETY_ES.md`
- **Privacy Policy**: Adaugă URL-ul politicii de confidențialitate
- **Screenshots**: Adaugă screenshot-uri din aplicație
- **App Access**: Adaugă cont demo din `REVIEWER_ACCESS.md`

### 10. 📍 Locație - Declarații
Dacă folosești locația:
- **Motivul**: "Para fichajes y registro de ubicación de empleados"
- **Evită background location** - nu adăuga `ACCESS_BACKGROUND_LOCATION`
- Declară clar în Data Safety că locația se folosește doar pentru fichaje

### 11. 🧪 Test pe dispozitive reale
- **Cameră**: Testează captura fotos pentru facturi
- **Geolocație**: Testează fichaje cu locație
- **Permisiuni**: Verifică că se cer corect runtime
- **Offline**: Testează că aplicația funcționează offline (PWA)

### 12. 🚀 Upload final
1. Upload AAB-ul în Play Console
2. Completează toate secțiunile
3. Trimite pentru review

## ⚠️ Verificări finale

### HTTPS & Security
- [ ] Toate endpoint-urile sunt HTTPS
- [ ] Nu există cleartext traffic
- [ ] CSP configurat corect
- [ ] CORS configurat pe backend

### Permisiuni
- [ ] Camera - pentru fotos facturi
- [ ] Location - pentru fichaje
- [ ] Internet - pentru API calls
- [ ] NU ACCESS_BACKGROUND_LOCATION

### PWA
- [ ] Manifest.json actualizat cu "De Camino"
- [ ] Service worker nu cache-ui API-urile sensibile
- [ ] Icons 192x192 și 512x512 prezente

### Android
- [ ] minSdkVersion >= 23
- [ ] targetSdkVersion actualizat
- [ ] Permisiuni în AndroidManifest.xml
- [ ] Proguard rules pentru Capacitor (dacă minify activat)

## 🎯 Scripturi NPM adăugate

```json
{
  "scripts": {
    "cap:copy": "npx cap copy",
    "cap:sync": "npx cap sync", 
    "cap:android": "npx cap open android"
  }
}
```

## 📞 Suport

Dacă întâmpini probleme:
1. Verifică logs în Android Studio (Logcat)
2. Testează PWA-ul în browser mai întâi
3. Verifică că toate endpoint-urile sunt accesibile
4. Confirmă că keystore-ul este corect configurat