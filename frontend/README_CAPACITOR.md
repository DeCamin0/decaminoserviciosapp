# 📱 Capacitor Android Setup - De Camino

## 🎯 Descriere
Acest document explică cum să sincronizezi și să deschizi proiectul Android pentru aplicația De Camino folosind Capacitor.

## 🚀 Comenzi uzuale

### Build și Sincronizare
```bash
# Build aplicația PWA
npm run build

# Copiază fișierele web în proiectul Android
npm run cap:copy

# Sincronizează pluginurile și configurațiile
npm run cap:sync

# Deschide Android Studio
npm run cap:android
```

### Comenzi Capacitor directe
```bash
# Sincronizare completă
npx cap sync

# Doar copiere fișiere web
npx cap copy

# Deschide Android Studio
npx cap open android
```

## 📁 Structura proiectului

```
decamino-web/
├── android/                 # Proiect Android generat
│   └── app/
│       └── src/
│           └── main/
│               ├── AndroidManifest.xml  # Permisiuni aici
│               └── assets/
├── dist/                    # Build PWA (se generează cu npm run build)
├── src/
│   └── lib/
│       └── native/
│           └── permissions.ts  # Utilitare permisiuni
├── capacitor.config.ts      # Configurație Capacitor
└── public/
    └── manifest.json        # PWA manifest
```

## ⚙️ Configurații importante

### Capacitor Config
- **Hosting**: Aplicația rulează din `https://app.decaminoservicios.com`
- **Fără bundled**: `bundledWebRuntime: false`
- **Doar HTTPS**: `cleartext: false`

### Permisiuni Android
Fișier: `android/app/src/main/AndroidManifest.xml`

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<!-- NU adăuga ACCESS_BACKGROUND_LOCATION -->
```

## 🔧 Pluginuri instalate

- `@capacitor/camera` - Pentru captura fotos facturi
- `@capacitor/geolocation` - Pentru fichaje cu locație
- `@capacitor/filesystem` - Pentru operațiuni fișiere
- `@capacitor/device` - Informații dispozitiv
- `@capacitor/network` - Status rețea
- `@capacitor/share` - Partajare conținut
- `@capacitor/toast` - Notificări toast
- `@capacitor/haptics` - Feedback tactil
- `@capacitor/app` - Control aplicație
- `@capacitor/keyboard` - Control tastatură
- `@capacitor/status-bar` - Control status bar
- `@capacitor/splash-screen` - Splash screen

## 📱 Generare APK/AAB

### Pentru testare internă (APK)
1. Deschide Android Studio: `npm run cap:android`
2. Build > Build Bundle(s) / APK(s) > Build APK(s)
3. APK-ul se generează în `android/app/build/outputs/apk/debug/`

### Pentru Play Store (AAB)
1. Build > Generate Signed Bundle / APK
2. Selectează "Android App Bundle"
3. Configurează keystore (o singură dată)
4. AAB-ul se generează în `android/app/build/outputs/bundle/release/`

## 🚨 Notițe importante

- **NU rula build** până nu ești gata să generezi APK/AAB
- Aplicația rulează din hosting, nu din fișiere locale
- Toate request-urile trebuie să fie HTTPS
- Permisiunile se cer runtime prin `src/lib/native/permissions.ts`

## 🔍 Debugging

### Logs Android
```bash
# Vezi logs în timp real
npx cap run android

# Sau în Android Studio: View > Tool Windows > Logcat
```

### Probleme comune
- **Sync eșuează**: Rulează `npm run build` mai întâi
- **Permisiuni refuzate**: Verifică `AndroidManifest.xml`
- **HTTPS errors**: Verifică că toate endpoint-urile sunt HTTPS

## 📚 Resurse utile

- [Capacitor Docs](https://capacitorjs.com/docs)
- [Android Permissions](https://developer.android.com/guide/topics/permissions/overview)
- [Play Console](https://play.google.com/console)
