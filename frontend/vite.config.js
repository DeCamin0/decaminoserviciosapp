import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { copyFileSync, mkdirSync, readFileSync, existsSync, writeFileSync } from 'fs'
import { join } from 'path'
// DISABLED: vite-plugin-imagemin has 31 vulnerabilities
// import viteImagemin from 'vite-plugin-imagemin'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

/** MIME pentru icon PWA / manifest după extensia fișierului din public/ */
function mimeFromLogoPath(logoPath) {
  const ext = (String(logoPath).split('.').pop() || '').toLowerCase()
  if (ext === 'svg') return 'image/svg+xml'
  if (ext === 'png') return 'image/png'
  if (ext === 'ico') return 'image/x-icon'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  return 'image/png'
}

/** Cale absolută în site pentru manifest (evită rezolvări relative greșite față de manifest.webmanifest) */
function manifestUrlPath(viteBasePath, fileName) {
  const base = (viteBasePath || '/').replace(/\/$/, '')
  const name = String(fileName || '').replace(/^\//, '')
  if (!base || base === '') return `/${name}`
  return `${base}/${name}`
}

/**
 * Dimensiuni + MIME reale din fișier (ex. logo.png poate fi JPEG; LOGO_hera.png e 2000×1000 → nu e maskable 512).
 * Edge refuză iconițe cu sizes fals / maskable pe imagini ne-pătrate → literă „H”.
 */
function getPublicIconMeta(filePath) {
  try {
    const buf = readFileSync(filePath)
    if (buf.length < 24) return null
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      const w = buf.readUInt32BE(16)
      const h = buf.readUInt32BE(20)
      return { mime: 'image/png', sizes: `${w}x${h}` }
    }
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2
      while (i < buf.length - 9) {
        if (buf[i] !== 0xff) {
          i++
          continue
        }
        const marker = buf[i + 1]
        if (marker >= 0xc0 && marker <= 0xc3) {
          const h = buf.readUInt16BE(i + 5)
          const w = buf.readUInt16BE(i + 7)
          return { mime: 'image/jpeg', sizes: `${w}x${h}` }
        }
        const segLen = buf.readUInt16BE(i + 2)
        i += 2 + segLen
      }
      return { mime: 'image/jpeg', sizes: '512x512' }
    }
    const head = buf.slice(0, Math.min(buf.length, 500)).toString('utf8').trimStart()
    if (head.includes('<svg')) {
      return { mime: 'image/svg+xml', sizes: 'any' }
    }
  } catch {
    /* ignore */
  }
  return null
}

/** Iconuri manifest: SVG acceptă 192/512 ca vector; raster: sizes trebuie să coincidă cu pixelii reali (altfel Edge → literă „H”). */
function buildPwaManifestIcons(abs, srcFile, mime, intrinsicSizes) {
  const isSvg = srcFile.toLowerCase().endsWith('.svg')
  if (isSvg) {
    return [
      { src: abs, sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
      { src: abs, sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
      { src: abs, sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
    ]
  }
  const intr = intrinsicSizes && /^\d+x\d+$/.test(String(intrinsicSizes)) ? String(intrinsicSizes) : ''
  if (intr) {
    return [{ src: abs, sizes: intr, type: mime, purpose: 'any' }]
  }
  return [
    { src: abs, sizes: '192x192', type: mime, purpose: 'any' },
    { src: abs, sizes: '512x512', type: mime, purpose: 'any' },
    { src: abs, sizes: '48x48', type: mime, purpose: 'any' }
  ]
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Încarcă .env ca titlul și logo-ul să fie corecte și la dev
  const env = loadEnv(mode, process.cwd(), '');
  // HERA (client2 sau mode hera): culoarea brand – albastru
  if (mode === 'client2' || mode === 'hera') {
    env.VITE_PRIMARY_COLOR = env.VITE_PRIMARY_COLOR || '#2563A8';
  }
  const getEnv = (key) => (env[key] != null && String(env[key]).trim() !== '' ? String(env[key]).trim() : '');
  // HERA build → dist-client2 ca să nu suprascrie dist/ (Decamino)
  const buildOutDir = (mode === 'client2' || mode === 'hera') ? 'dist-client2' : 'dist';

  // PWA: același manifest nu trebuie să listeze favicon.ico partajat + logo.svg Decamino la build Hera.
  const logoPath = (getEnv('VITE_LOGO_PATH') || 'logo.svg').trim();
  const pwaIconEnv = getEnv('VITE_PWA_ICON');
  const publicDir = join(process.cwd(), 'public');
  const manifestIconSrc = (() => {
    if (pwaIconEnv && existsSync(join(publicDir, pwaIconEnv))) return pwaIconEnv;
    // LOGO_hera.png e foarte lat (ex. 2000×1000). Manifest cu sizes 192/512 pe același URL → Edge respinge iconurile → literă „H”. Preferă vectorul dacă există.
    const heraSvg = 'logo-hera.svg';
    if (existsSync(join(publicDir, heraSvg)) && /^logo_hera\.png$/i.test(logoPath.trim())) {
      return heraSvg;
    }
    if (logoPath.toLowerCase().endsWith('.svg')) {
      const png = logoPath.replace(/\.svg$/i, '.png');
      if (existsSync(join(publicDir, png))) {
        // PWA / favicon: logo.png (fundal alb) se vede mai bine la instalare decât SVG transparent; MIME real din fișier (PNG sau JPEG)
        return png;
      }
      return logoPath;
    }
    return logoPath;
  })();
  const manifestIconFsPath = join(publicDir, manifestIconSrc);
  const iconMeta = existsSync(manifestIconFsPath) ? getPublicIconMeta(manifestIconFsPath) : null;
  // Tipul din manifest trebuie să coincidă cu Content-Type la GET /logo.png (Vite: după extensie → image/png).
  // logo.png poate fi JPEG la byte-level; dacă punem image/jpeg în manifest dar serverul trimite image/png, Chrome/Edge invalidează PWA → dispare „Instalar”.
  const manifestIconMime = mimeFromLogoPath(manifestIconSrc);
  const manifestIconSizes = iconMeta?.sizes || (manifestIconSrc.toLowerCase().endsWith('.svg') ? 'any' : '512x512');
  const manifestIconAbs = manifestUrlPath(env.VITE_BASE_PATH, manifestIconSrc);
  const pwaManifestIcons = buildPwaManifestIcons(
    manifestIconAbs,
    manifestIconSrc,
    manifestIconMime,
    manifestIconSizes
  );
  /** Favicon tab: logo brand (VITE_LOGO_PATH), nu VITE_PWA_ICON – instalarea PWA folosește doar manifest.icons. */
  const faviconTabSrc =
    logoPath && existsSync(join(publicDir, logoPath)) ? logoPath : manifestIconSrc;
  const pwaIncludeAssets = (() => {
    const s = new Set();
    if (existsSync(join(publicDir, 'favicon.ico'))) s.add('favicon.ico');
    for (const f of [logoPath, manifestIconSrc, pwaIconEnv]) {
      if (f && existsSync(join(publicDir, f))) s.add(f);
    }
    return [...s];
  })();

  return {
  // Deploy pe subdomeniu la rădăcină → servește din root
  // Pentru test environment pe /html/app-test, setează VITE_BASE_PATH=/html/app-test/
  base: env.VITE_BASE_PATH || '/',
  plugins: [
    // GET /favicon.ico: tab = VITE_LOGO_PATH (brand); manifest PWA = alt asset (ex. logo-hera-solo.png).
    {
      name: 'favicon-ico-match-brand',
      enforce: 'pre',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const pathOnly = (req.url && req.url.split('?')[0]) || '';
          if (pathOnly !== '/favicon.ico') return next();
          try {
            const src = join(publicDir, faviconTabSrc);
            if (!existsSync(src)) return next();
            const buf = readFileSync(src);
            const isSvg = faviconTabSrc.toLowerCase().endsWith('.svg');
            res.setHeader(
              'Content-Type',
              isSvg ? 'image/svg+xml; charset=utf-8' : mimeFromLogoPath(faviconTabSrc)
            );
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.statusCode = 200;
            res.end(buf);
          } catch {
            next();
          }
        });
      },
      // După copy din public/, suprascrie dist/.../favicon.ico cu logo tab (VITE_LOGO_PATH), nu iconul PWA dedicat.
      closeBundle() {
        const outDir = join(process.cwd(), buildOutDir);
        const src = join(publicDir, faviconTabSrc);
        if (!existsSync(src)) return;
        try {
          copyFileSync(src, join(outDir, 'favicon.ico'));
        } catch {
          /* ignore */
        }
      },
    },
    nodePolyfills({
      include: ['process', 'buffer', 'util', 'stream', 'crypto', 'path'],
      exclude: ['fs', 'vm'],
      globals: {
        Buffer: true,
        global: true,
        process: true
      }
    }),
    react(),
    // Afișează în consolă versiunea de build creată
    {
      name: 'log-build-version',
      buildStart() {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const stamp = `${now.getFullYear()}.${pad(now.getMonth()+1)}.${pad(now.getDate())}.${pad(now.getHours())}${pad(now.getMinutes())}`;
        const pkgVersion = process.env.npm_package_version || '1.0.0';
        const buildVersion = `${pkgVersion}-${stamp}`;
        console.log(`\n==============================`);
        console.log(`🚀 Building app version: ${buildVersion}`);
        console.log(`==============================\n`);
      },
      closeBundle() {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const stamp = `${now.getFullYear()}.${pad(now.getMonth()+1)}.${pad(now.getDate())}.${pad(now.getHours())}${pad(now.getMinutes())}`;
        const pkgVersion = process.env.npm_package_version || '1.0.0';
        const buildVersion = `${pkgVersion}-${stamp}`;
        console.log(`\n==============================`);
        console.log(`✅ Build completed. Version: ${buildVersion}`);
        console.log(`==============================\n`);
      }
    },
    // Injectează versiunea, titlul, logo, app name și culori brand din .env în index.html (dev + build, multi-client)
    {
      name: 'inject-html-version',
      transformIndexHtml(html) {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const buildVersion = `${now.getFullYear()}.${pad(now.getMonth()+1)}.${pad(now.getDate())}.${pad(now.getHours())}${pad(now.getMinutes())}`;
        const appName = getEnv('VITE_APP_NAME') || getEnv('VITE_COMPANY_NAME') || '';
        const logoPath = (getEnv('VITE_LOGO_PATH') || 'logo.svg').trim();
        const logoPng = logoPath.replace(/\.(svg|jpg|jpeg|gif|webp)$/i, '.png');
        const iconType = mimeFromLogoPath(logoPath);
        let out = html.replace(/<html([^>]*)data-version="[^"]*"([^>]*)>/,
                            `<html$1 data-version="${buildVersion}"$2>`)
                   .replace(/<html(?![^>]*data-version)([^>]*)>/,
                            `<html$1 data-version="${buildVersion}">`);
        out = out.replace(/__VITE_APP_NAME__/g, appName);
        out = out.replace(/__VITE_LOGO_PATH__/g, logoPath);
        out = out.replace(/__VITE_LOGO_PNG__/g, logoPng);
        out = out.replace(/__VITE_ICON_TYPE__/g, iconType);
        out = out.replace(/<title>.*?<\/title>/, `<title>${appName}</title>`);
        out = out.replace(/(<meta\s+property="og:site_name"\s+content=")[^"]*(")/, `$1${appName}$2`);
        out = out.replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/, `$1${appName}$2`);
        out = out.replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*(")/, `$1${appName}$2`);

        // Culori brand din env – injectate în :root ca să fie disponibile din primul frame (login Client 2 = teal)
        const rawPrimary = (getEnv('VITE_PRIMARY_COLOR') || '#CC0000').trim();
        const primaryHex = rawPrimary.startsWith('#') ? rawPrimary : `#${rawPrimary}`;
        console.log('[vite inject] VITE_PRIMARY_COLOR:', rawPrimary || '(empty)', '→', primaryHex);
        const hexToRgb = (hex) => {
          const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
          return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
        };
        const rgbToHex = (r, g, b) => '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('');
        const rgb = hexToRgb(primaryHex);
        let primaryVars = '';
        if (rgb) {
          const darker = rgbToHex(rgb.r - 20, rgb.g - 20, rgb.b - 20);
          const darkest = rgbToHex(rgb.r - 40, rgb.g - 40, rgb.b - 40);
          primaryVars = `:root{--primary-color:${primaryHex};--primary-color-darker:${darker};--primary-color-darkest:${darkest};--primary-color-rgb:${rgb.r}, ${rgb.g}, ${rgb.b};--primary-color-rgba-01:rgba(${rgb.r},${rgb.g},${rgb.b},0.1);--primary-color-rgba-02:rgba(${rgb.r},${rgb.g},${rgb.b},0.2);--primary-color-rgba-04:rgba(${rgb.r},${rgb.g},${rgb.b},0.4);--primary-color-rgba-05:rgba(${rgb.r},${rgb.g},${rgb.b},0.5);--primary-color-rgba-06:rgba(${rgb.r},${rgb.g},${rgb.b},0.6);}`;
        } else {
          primaryVars = `:root{--primary-color:${primaryHex};--primary-color-darker:${primaryHex};--primary-color-darkest:${primaryHex};}`;
        }
        const styleTag = `<style id="vite-primary-vars">${primaryVars}</style>`;
        if (out.includes('VITE_PRIMARY_CSS_VARS')) {
          out = out.replace('<!-- VITE_PRIMARY_CSS_VARS injectat de vite.config.js (culori brand per client) -->', styleTag);
        } else if (!out.includes('id="vite-primary-vars"')) {
          out = out.replace('</head>', `${styleTag}\n  </head>`);
        }
        // Setare --primary-color din prima milisecundă (evită cache: scriptul rulează mereu cu valoarea corectă)
        const setVarsScript = rgb
          ? `(function(){var d=document.documentElement;d.style.setProperty('--primary-color','${primaryHex}');d.style.setProperty('--primary-color-darker','${rgbToHex(rgb.r - 20, rgb.g - 20, rgb.b - 20)}');d.style.setProperty('--primary-color-darkest','${rgbToHex(rgb.r - 40, rgb.g - 40, rgb.b - 40)}');d.style.setProperty('--primary-color-rgb','${rgb.r}, ${rgb.g}, ${rgb.b}');d.style.setProperty('--primary-color-rgba-01','rgba(${rgb.r},${rgb.g},${rgb.b},0.1)');d.style.setProperty('--primary-color-rgba-02','rgba(${rgb.r},${rgb.g},${rgb.b},0.2)');d.style.setProperty('--primary-color-rgba-04','rgba(${rgb.r},${rgb.g},${rgb.b},0.4)');d.style.setProperty('--primary-color-rgba-05','rgba(${rgb.r},${rgb.g},${rgb.b},0.5)');d.style.setProperty('--primary-color-rgba-06','rgba(${rgb.r},${rgb.g},${rgb.b},0.6)');})();`
          : `(function(){document.documentElement.style.setProperty('--primary-color','${primaryHex}');})();`;
        const scriptTag = `<script id="vite-primary-set">${setVarsScript}</script>`;
        if (!out.includes('id="vite-primary-set"')) {
          out = out.replace('<head>', '<head>\n    ' + scriptTag);
        }
        // data-primary-color pe <html> ca backup (doar dacă lipsește)
        if (!out.includes('data-primary-color=')) {
          out = out.replace(/<html(\s)/i, '<html data-primary-color="' + primaryHex + '"$1');
        }
        return out;
      }
    },
    // La build: înlocuiește placeholders în firmar*.html (URL-uri + culori/logo per client)
    {
      name: 'inject-firmar-env',
      closeBundle() {
        const outDir = join(process.cwd(), buildOutDir);
        const apiUrl = getEnv('VITE_API_URL') || '';
        const externalUrl = getEnv('VITE_EXTERNAL_SITE_URL') || '';
        const appName = getEnv('VITE_APP_NAME') || getEnv('VITE_COMPANY_NAME') || 'De Camino Servicios';
        const logoPath = getEnv('VITE_LOGO_PATH') || 'logo.svg';
        let primaryHex = (getEnv('VITE_PRIMARY_COLOR') || '#CC0000').trim();
        if (!primaryHex.startsWith('#')) primaryHex = '#' + primaryHex;
        const hexToRgb = (hex) => {
          const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
          return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
        };
        const rgbToHex = (r, g, b) => '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('');
        const rgb = hexToRgb(primaryHex);
        const primaryDark = rgb ? rgbToHex(rgb.r - 40, rgb.g - 40, rgb.b - 40) : primaryHex;
        for (const name of ['firmar.html', 'firmar-informe.html']) {
          const p = join(outDir, name);
          if (existsSync(p)) {
            let html = readFileSync(p, 'utf8');
            html = html.replace(/%VITE_API_URL%/g, apiUrl);
            html = html.replace(/%VITE_EXTERNAL_SITE_URL%/g, externalUrl);
            html = html.replace(/%VITE_APP_NAME%/g, appName);
            html = html.replace(/%VITE_LOGO_PATH%/g, logoPath);
            html = html.replace(/%VITE_PRIMARY_COLOR%/g, primaryHex);
            html = html.replace(/%VITE_PRIMARY_DARK%/g, primaryDark);
            writeFileSync(p, html);
          }
        }
      }
    },
    // Plugin PWA cu configurație optimizată pentru a preveni conflicts
    VitePWA({
      registerType: 'autoUpdate', // Actualizare automată: la următoarea deschidere userii primesc noua versiune fără prompt
      includeAssets: pwaIncludeAssets,
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB - pentru fișiere mari (pdf-libs, vendor)
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB
        skipWaiting: true, // Activează automat noul Service Worker (fără a aștepta)
        clientsClaim: true, // Claim clients imediat pentru a activa noul Service Worker
        cleanupOutdatedCaches: true,
        // Adaugă versioning explicit pentru a forța actualizările
        // Workbox generează automat hash-uri pentru fișiere, dar adăugăm și un cache ID cu versiune
        cacheId: `app-v2-${mode}-${process.env.npm_package_version || '1.0.0'}`,
        // Configurație pentru a preveni conflicts
        navigateFallback: (process.env.VITE_BASE_PATH || '/') + 'index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/webhook\//, /\/firmar\.html($|\?)/],
        // Cache strategy pentru a preveni conflicts
        runtimeCaching: (() => {
          const n8nBase = (process.env.VITE_N8N_BASE_URL && String(process.env.VITE_N8N_BASE_URL).trim()) || '';
          if (!n8nBase) return [];
          try {
            const origin = n8nBase.replace(/\/$/, '');
            return [{
              urlPattern: new RegExp(`^${origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\/webhook\\/`),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                networkTimeoutSeconds: 10,
                cacheableResponse: { statuses: [0, 200] }
              }
            }];
          } catch {
            return [];
          }
        })()
      },
      manifest: {
        id: `/pwa-${mode}`,
        name: getEnv('VITE_APP_NAME') || getEnv('VITE_COMPANY_NAME') || 'App',
        short_name: getEnv('VITE_APP_NAME') || getEnv('VITE_COMPANY_NAME') || 'App',
        description: 'Aplicación web para gestión de empleados y servicios auxiliares',
        theme_color: getEnv('VITE_PRIMARY_COLOR') || '#CC0000',
        background_color: '#ffffff',
        display: 'standalone',
        scope: env.VITE_BASE_PATH || '/',
        // &c=mode discriminează tenantul fără a schimba rutele (query e ignorat de router).
        start_url: `${env.VITE_BASE_PATH || '/'}?v=${process.env.npm_package_version || Date.now()}&c=${mode}`,
        lang: 'es',
        categories: ['business', 'productivity'],
        version: process.env.npm_package_version || '1.0.0', // Adaugă versiunea în manifest
        icons: pwaManifestIcons
      },
      devOptions: {
        enabled: true,
        type: 'module'
      }
    }),
    // Plugin personalizat pentru a copia fișierele AutoFirma
    {
      name: 'copy-autofirma-files',
      configureServer(server) {
        // Middleware pentru a servi fișierele statice prin ngrok - PRIMUL MIDDLEWARE
        server.middlewares.use('/logo.svg', (req, res) => {
          console.log('🔍 Serving logo.svg via middleware');
          try {
            const filePath = join(process.cwd(), 'public', '/logo.svg');
            if (existsSync(filePath)) {
              const fileContent = readFileSync(filePath);
              res.setHeader('Content-Type', 'image/svg+xml');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.statusCode = 200;
              res.end(fileContent);
              console.log('✅ logo.svg served successfully');
              return;
            }
          } catch (error) {
            console.error('❌ Error serving logo.svg:', error);
          }
          res.statusCode = 404;
          res.end('Not found');
        });

        // PWA folosește manifest.webmanifest (VitePWA). public/manifest.json rămâne în public/ și e servit de Vite ca /manifest.json dacă e nevoie (legacy); nu duplicăm aici.

        server.middlewares.use('/DeCamino-04.svg', (req, res) => {
          console.log('🔍 Serving DeCamino-04.svg via middleware');
          try {
            const filePath = join(process.cwd(), 'public', '/DeCamino-04.svg');
            if (existsSync(filePath)) {
              const fileContent = readFileSync(filePath);
              res.setHeader('Content-Type', 'image/svg+xml');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.statusCode = 200;
              res.end(fileContent);
              console.log('✅ DeCamino-04.svg served successfully');
              return;
            }
          } catch (error) {
            console.error('❌ Error serving DeCamino-04.svg:', error);
          }
          res.statusCode = 404;
          res.end('Not found');
        });

        // Middleware pentru assets prin ngrok
        server.middlewares.use((req, res, next) => {
          // Permite accesul la toate assets-urile prin ngrok
          if (req.url.startsWith('/src/assets/') || req.url.startsWith('/logo.svg') || req.url.startsWith('/favicon.ico')) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
          }
          next();
        });

        // La dev: injectează culori/logo în firmar*.html per client (ca la build)
        // Match și cu query (?id=1) ca /firmar.html?id=1 să primească HTML-ul cu placeholders înlocuite
        server.middlewares.use((req, res, next) => {
          const pathname = req.url && req.url.split('?')[0];
          const name = pathname === '/firmar.html' ? 'firmar.html' : pathname === '/firmar-informe.html' ? 'firmar-informe.html' : null;
          if (!name) return next();
          try {
            const p = join(process.cwd(), 'public', name);
            if (!existsSync(p)) return next();
            let html = readFileSync(p, 'utf8');
            const appName = getEnv('VITE_APP_NAME') || getEnv('VITE_COMPANY_NAME') || 'De Camino Servicios';
            const logoPath = getEnv('VITE_LOGO_PATH') || 'logo.svg';
            let primaryHex = (getEnv('VITE_PRIMARY_COLOR') || '#CC0000').trim();
            if (!primaryHex.startsWith('#')) primaryHex = '#' + primaryHex;
            const hexToRgb = (hex) => {
              const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
              return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
            };
            const rgbToHex = (r, g, b) => '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('');
            const rgb = hexToRgb(primaryHex);
            const primaryDark = rgb ? rgbToHex(rgb.r - 40, rgb.g - 40, rgb.b - 40) : primaryHex;
            const apiUrl = getEnv('VITE_API_URL') || '';
            const externalUrl = getEnv('VITE_EXTERNAL_SITE_URL') || '';
            html = html.replace(/%VITE_API_URL%/g, apiUrl).replace(/%VITE_EXTERNAL_SITE_URL%/g, externalUrl);
            html = html.replace(/%VITE_APP_NAME%/g, appName).replace(/%VITE_LOGO_PATH%/g, logoPath);
            html = html.replace(/%VITE_PRIMARY_COLOR%/g, primaryHex).replace(/%VITE_PRIMARY_DARK%/g, primaryDark);
            res.setHeader('Content-Type', 'text/html');
            res.end(html);
          } catch (e) {
            next();
          }
        });

        // Pentru development mode
        server.middlewares.use('/autofirma.html', (req, res, next) => {
          try {
            const filePath = join(process.cwd(), 'src/lib/autofirma/autofirma.html');
            res.setHeader('Content-Type', 'text/html');
            res.end(require('fs').readFileSync(filePath, 'utf8'));
          } catch (error) {
            next();
          }
        });
        
        // Autoscript is now served from public/vendor/autoscript.js via static files
      },
      writeBundle() {
        try {
          // Pentru build mode
          mkdirSync(join(process.cwd(), 'dist'), { recursive: true });
          
          copyFileSync(
            join(process.cwd(), 'src/lib/autofirma/autofirma.html'),
            join(process.cwd(), 'dist/autofirma.html')
          );
          
          // Copy vendor files
          copyFileSync(
            join(process.cwd(), 'public/vendor/autoscript.js'),
            join(process.cwd(), 'dist/vendor/autoscript.js')
          );
          
          console.log('✅ Fișierele AutoFirma au fost copiate în dist/');
        } catch (error) {
          console.error('❌ Eroare la copierea fișierelor AutoFirma:', error);
        }
      }
    },
    // Plugin pentru a copia PDF.js worker cu extensia .js pentru compatibilitate server
    {
      name: 'copy-pdf-worker',
      closeBundle() {
        try {
          const pdfWorkerPath = join(process.cwd(), 'node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
          const distPath = join(process.cwd(), 'dist');
          const targetPath = join(distPath, 'pdf.worker.min.js');
          
          if (existsSync(pdfWorkerPath)) {
            mkdirSync(distPath, { recursive: true });
            copyFileSync(pdfWorkerPath, targetPath);
            console.log('✅ PDF.js worker copiat ca .js pentru compatibilitate server');
          }
        } catch (error) {
          console.warn('⚠️ Nu s-a putut copia PDF.js worker:', error.message);
        }
      }
    }
    // DISABLED: vite-plugin-imagemin has 31 vulnerabilities
    // 🖼️ IMAGE OPTIMIZATION PLUGIN - Optimizare automată pentru imagini
    // viteImagemin({
    //   // Optimizare pentru toate tipurile de imagini
    //   gifsicle: {
    //     optimizationLevel: 7,
    //     interlaced: false
    //   },
    //   mozjpeg: {
    //     quality: 80,
    //     progressive: true
    //   },
    //   pngquant: {
    //     quality: [0.65, 0.8],
    //     speed: 4
    //   },
    //   svgo: {
    //     plugins: [
    //       {
    //         name: 'removeViewBox',
    //         active: false
    //       },
    //       {
    //         name: 'removeEmptyAttrs',
    //         active: false
    //       },
    //       {
    //         name: 'removeUselessStrokeAndFill',
    //         active: false
    //       }
    //     ]
    //   },
    //   webp: {
    //     quality: 80
    //   }
    // })
  ],
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  optimizeDeps: {
    // Specifică doar entry point-urile corecte pentru dependency scanning
    entries: [
      'index.html'
    ],
    // Include react-quill pentru pre-bundling
    include: [
      'react-quill',
      'quill',
      'pdfmake/build/pdfmake',
      'pdfmake/build/vfs_fonts'
    ],
    // Exclude path-urile virtuale create de vite-plugin-node-polyfills
    // Folosim pattern matching pentru a exclude toate path-urile virtuale
    exclude: [
      '@esbuild-plugins/node-globals-polyfill',
      '@esbuild-plugins/node-globals-polyfill/_virtual-process-polyfill_.js'
    ],
    // Forțează re-bundling doar dacă este necesar
    force: false
  },
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    // Culori brand – forțat din env (Client 2 = teal când mode === 'client2')
    'import.meta.env.VITE_PRIMARY_COLOR': JSON.stringify(env.VITE_PRIMARY_COLOR || '#CC0000'),
    // Variabile de mediu pentru AutoFirma
    'import.meta.env.VITE_SIGNING_MOCK': JSON.stringify('0'), // 0 = AutoFirma reală, 1 = Mock mode
    'import.meta.env.VITE_API_BASE': JSON.stringify(process.env.VITE_N8N_BASE_URL || ''), // Folosește VITE_N8N_BASE_URL din .env.local
    'import.meta.env.VITE_BASE_PATH': JSON.stringify(process.env.VITE_BASE_PATH || '/'), // Base path pentru deployment
    // Fix pentru ExcelJS care încearcă să acceseze _process
    '_process': JSON.stringify({}),
    'process.env': JSON.stringify({}),
  },
  build: {
    outDir: buildOutDir,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // 🎯 BUNDLE SPLITTING MAI AGRESIV - Optimizare pentru performanță maximă
          
          // 1. CORE REACT - Chunk principal (205KB)
          if (id.includes('react') || id.includes('react-dom')) {
            return 'react-core';
          }
          
          // 2. ROUTING - Chunk separat pentru routing (45KB)
          if (id.includes('react-router')) {
            return 'router';
          }
          
          // 3. PDF LIBRARIES - Chunk mare separat (2.9MB) - LAZY LOADING
          if (id.includes('pdfmake') || id.includes('pdfjs-dist') || id.includes('pdf-lib') || id.includes('@react-pdf')) {
            return 'pdf-libs';
          }
          
          // 3b. CRYPTO LIBRARIES - Skip problematic crypto libs from vendor
          if (id.includes('crypto-browserify') || id.includes('browserify-cipher') || id.includes('create-hash') || id.includes('create-hmac')) {
            return 'crypto-polyfill';
          }
          
          // 4. EXCEL/OFFICE - DEZACTIVAT pentru a preveni eroarea _process
          // Bibliotecile ExcelJS nu funcționează corect în browser din cauza dependențelor Node.js
          // if (id.includes('exceljs') || id.includes('xlsx') || id.includes('jszip')) {
          //   return 'office-libs';
          // }
          
          // 5. MAPS - Chunk separat pentru Google Maps (800KB) - LAZY LOADING
          if (id.includes('@react-google-maps') || id.includes('google-maps')) {
            return 'maps-libs';
          }
          
          // 6. FORM LIBRARIES - Chunk pentru formulare (150KB)
          if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod')) {
            return 'form-libs';
          }
          
          // 8. UI LIBRARIES - Chunk pentru UI (200KB)
          if (id.includes('lucide-react') || id.includes('react-chatbot')) {
            return 'ui-libs';
          }
          
          // 9. UTILITY LIBRARIES - Chunk pentru utilități (180KB)
          if (id.includes('axios') || id.includes('html2canvas') || id.includes('qrcode') || id.includes('signature_pad')) {
            return 'utils';
          }
          
          // 9b. EXCEL EXPORT - Chunk separat pentru export Excel
          if (id.includes('exportExcel')) {
            return 'excel-export';
          }
          
          // 10. I18N - Chunk pentru internaționalizare (50KB)
          if (id.includes('i18next') || id.includes('react-i18next')) {
            return 'i18n';
          }
          
          // 11. PWA LIBRARIES - Chunk pentru PWA (100KB)
          if (id.includes('workbox') || id.includes('vite-plugin-pwa')) {
            return 'pwa-libs';
          }
          
          // 12. CHART LIBRARIES - Chunk pentru grafice (250KB) - LAZY LOADING
          if (id.includes('chart.js') || id.includes('recharts') || id.includes('d3')) {
            return 'chart-libs';
          }
          
          // 13. DATE LIBRARIES - Chunk pentru date (80KB)
          if (id.includes('date-fns') || id.includes('moment') || id.includes('dayjs')) {
            return 'date-libs';
          }
          
          // 14. VALIDATION LIBRARIES - Chunk pentru validare (60KB)
          if (id.includes('yup') || id.includes('joi') || id.includes('validator')) {
            return 'validation-libs';
          }
          
          // 15. HTTP LIBRARIES - Chunk pentru HTTP (120KB)
          if (id.includes('axios') || id.includes('fetch') || id.includes('request')) {
            return 'http-libs';
          }
          
          // 16. STORAGE LIBRARIES - Chunk pentru storage (40KB)
          if (id.includes('localforage') || id.includes('idb') || id.includes('dexie')) {
            return 'storage-libs';
          }
          
          // 17. ANIMATION LIBRARIES - Chunk pentru animații (90KB)
          if (id.includes('framer-motion') || id.includes('react-spring') || id.includes('lottie')) {
            return 'animation-libs';
          }
          
          // 18. VENDOR LIBRARIES - Chunk pentru biblioteci mari (500KB)
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      },
      // 🎯 OPTIMIZĂRI TREESHAKE PENTRU BUNDLE SPLITTING MAI AGRESIV
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false
      }
    },
    chunkSizeWarningLimit: 1000, // Mărit limita pentru chunk-urile mari
    // Copiază fișierele AutoFirma în dist
    copyPublicDir: true,
    assetsInclude: ['**/*.html', '**/*.js'],
    // 🚀 OPTIMIZĂRI BUNDLE SPLITTING MAI AGRESIV
    minify: 'esbuild', // TEMPORAR: Schimbă la esbuild pentru debugging mai ușor (mai rapid și mai puțin agresiv)
    // Nu mai folosim terserOptions pentru esbuild
    // CSS optimizations pentru a evita avertizările
    cssCodeSplit: true,
    cssMinify: false, // Dezactivează minificarea CSS pentru a evita avertizările
    // 🎯 OPTIMIZĂRI SUPLIMENTARE PENTRU BUNDLE SPLITTING
    target: 'es2020', // Target modern pentru optimizări mai bune
    sourcemap: true, // TEMPORAR: Activează sourcemap-urile pentru debugging în producție
    reportCompressedSize: true // Raportează dimensiunea comprimată
  },
  preview: {
    proxy: {
      '/webhook': {
        target: (process.env.VITE_N8N_BASE_URL && String(process.env.VITE_N8N_BASE_URL).trim()) || 'http://localhost',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path,
        timeout: 10000,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
        }
      }
    }
  },
  server: {
    host: '0.0.0.0', // Allow all external connections
    port: 5173,
    strictPort: true,
    allowedHosts: [
      '3b7a7cbfa73b.ngrok-free.app',
      'be2e4eb99e46.ngrok-free.app',
      '6d3c5f997b87.ngrok-free.app', // Adăugat URL-ul tău ngrok
      '.ngrok-free.app',
      '.ngrok.io',
      'localhost',
      '127.0.0.1'
    ],
    cors: {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    },
    // Middleware pentru assets prin ngrok
    middlewareMode: false,
    fs: {
      strict: false
    },
    headers: {
      'Permissions-Policy': 'unload=*, geolocation=(self)',
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
      'Cross-Origin-Opener-Policy': 'same-origin'
    },
    // Dev middleware pentru a corecta Content-Type pentru fișiere .mjs servite de clientul Vite (env.mjs)
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url && req.url.includes('/node_modules/vite/dist/client/env.mjs')) {
          res.setHeader('Content-Type', 'application/javascript');
        }
        next();
      });
    },
    // ⚠️ PROXY-URI N8N - Doar pentru development
    // Proxy-urile dead code au fost comentate (contracte, AutoFirma legacy, login/usuarios migrat, avatare, inspecciones, documentos oficiales, etc.)
    // Proxy-uri ACTIVE: /webhook (generic pentru endpoint-uri nemigrate), /api/n8n (generic pentru endpoint-uri nemigrate)
    proxy: {
      // Generic proxy pentru toate endpoint-urile /webhook/* (folosit pentru multe endpoint-uri nemigrate)
      '/webhook': {
        target: (process.env.VITE_N8N_BASE_URL && String(process.env.VITE_N8N_BASE_URL).trim()) || 'http://localhost',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path,
        timeout: 60000, // mărit pentru rapoarte anuale lente
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
        },
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
            // Adaugă CORS headers la răspuns
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
            proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
          });
        },
      },

      // ⚠️ DEAD CODE - webhook-test folosit doar în test-n8n-endpoint.js (fișier de test)
      // '/webhook-test': {
      //   target: 'https://n8n.decaminoservicios.com',
      //   changeOrigin: true,
      //   secure: true,
      //   rewrite: (path) => path,
      //   timeout: 30000, // 30 secunde timeout pentru teste
      //   headers: {
      //     'Access-Control-Allow-Origin': '*',
      //     'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      //     'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
      //   },
      //   configure: (proxy, options) => {
      //     proxy.on('error', (err, req, res) => {
      //       console.log('webhook-test proxy error', err);
      //     });
      //     proxy.on('proxyReq', (proxyReq, req, res) => {
      //       console.log('Sending Test Request to:', req.method, req.url);
      //     });
      //     proxy.on('proxyRes', (proxyRes, req, res) => {
      //       console.log('Received Test Response:', proxyRes.statusCode, req.url);
      //       // Adaugă CORS headers la răspuns
      //       proxyRes.headers['Access-Control-Allow-Origin'] = '*';
      //       proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      //       proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
      //     });
      //   },
      // },

      // ⚠️ DEAD CODE - getAvatar migrat la routes.getAvatar (backend /api/avatar)
      // '/webhook/getavatar': {
      //   target: 'https://n8n.decaminoservicios.com',
      //   changeOrigin: true,
      //   secure: true,
      //   rewrite: (path) => path,
      //   timeout: 30000,
      //   headers: {
      //     'Access-Control-Allow-Origin': '*',
      //     'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      //     'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
      //   },
      //   configure: (proxy, options) => {
      //     proxy.on('error', (err, req, res) => {
      //       console.log('getavatar proxy error', err);
      //     });
      //     proxy.on('proxyReq', (proxyReq, req, res) => {
      //       console.log('Sending Avatar Request to:', req.method, req.url);
      //     });
      //     proxy.on('proxyRes', (proxyRes, req, res) => {
      //       console.log('Received Avatar Response:', proxyRes.statusCode, req.url);
      //       proxyRes.headers['Access-Control-Allow-Origin'] = '*';
      //       proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      //       proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
      //     });
      //   },
      // },

      // ⚠️ DEAD CODE - contractele au fost eliminate din ClientesPage.jsx
      // '/contracts': {
      //   target: 'https://n8n.decaminoservicios.com',
      //   changeOrigin: true,
      //   secure: true,
      //   rewrite: (path) => {
      //     // Pentru GET requests, folosește endpoint-ul de test pentru afișare
      //     if (path.includes('?nif=')) {
      //       return path.replace(/^\/contracts/, '/webhook/8e669710-0850-4b9b-b48e-fc19d09e4841');
      //     }
      //     // Pentru POST requests, folosește endpoint-ul de producție pentru upload
      //     return path.replace(/^\/contracts/, '/webhook/f1535e89-f74b-4df3-8516-5dfdda8c6b35');
      //   },
      //   timeout: 30000, // 30 secunde pentru fișiere mari
      //   configure: (proxy, options) => {
      //     proxy.on('error', (err, req, res) => {
      //       console.log('contracts proxy error', err);
      //     });
      //     proxy.on('proxyReq', (proxyReq, req, res) => {
      //       console.log('Sending Contract Request to:', req.method, req.url);
      //     });
      //     proxy.on('proxyRes', (proxyRes, req, res) => {
      //       console.log('Received Download Contract Response:', proxyRes.statusCode, req.url);
      //     });
      //   },
      // },
      // ⚠️ DEAD CODE - downloadContract nu este folosit nicăieri
      // '/download-contract': {
      //   target: 'https://n8n.decaminoservicios.com',
      //   changeOrigin: true,
      //   secure: true,
      //   rewrite: (path) => path.replace(/^\/download-contract/, '/webhook/6cb6b98c-9127-494c-8201-f097d14b9c13'),
      //   timeout: 30000, // 30 secunde pentru fișiere mari
      //   configure: (proxy, options) => {
      //     proxy.on('error', (err, req, res) => {
      //       console.log('download-contract proxy error', err);
      //     });
      //     proxy.on('proxyReq', (proxyReq, req, res) => {
      //       console.log('Sending Download Contract Request to:', req.method, req.url);
      //     });
      //     proxy.on('proxyRes', (proxyRes, req, res) => {
      //       console.log('Received Download Contract Response:', proxyRes.statusCode, req.url);
      //     });
      //   },
      // },
      '/api/n8n': {
        target: (process.env.VITE_N8N_BASE_URL && String(process.env.VITE_N8N_BASE_URL).trim()) || 'http://localhost',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/n8n/, ''),
        secure: true,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-App-Source, X-App-Version, X-Client-Type'
        },
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('API proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Proxying API request:', req.method, req.url);
            // Log headers pentru debugging
            console.log('Request headers:', req.headers);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('API proxy response:', proxyRes.statusCode, req.url);
            // Adaugă CORS headers la răspuns
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
            proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-App-Source, X-App-Version, X-Client-Type';
          });
        }
      },

      // ⚠️ DEAD CODE - getDocumentosOficiales migrat la routes.getDocumentosOficiales (backend /api/documentos-oficiales)
      // '/webhook/171d8236-6ef1-4b97-8605-096476bc1d8b': {
      //   target: 'https://n8n.decaminoservicios.com',
      //   changeOrigin: true,
      //   secure: true,
      //   rewrite: (path) => path,
      //   timeout: 10000,
      //   headers: {
      //     'Access-Control-Allow-Origin': '*',
      //     'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      //     'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
      //   },
      //   configure: (proxy, options) => {
      //     proxy.on('error', (err, req, res) => {
      //       console.log('documentos oficiales proxy error', err);
      //     });
      //     proxy.on('proxyReq', (proxyReq, req, res) => {
      //       console.log('Sending Documentos Oficiales Request to:', req.method, req.url);
      //     });
      //     proxy.on('proxyRes', (proxyRes, req, res) => {
      //       console.log('Received Documentos Oficiales Response:', proxyRes.statusCode, req.url);
      //       // Adaugă CORS headers la răspuns
      //       proxyRes.headers['Access-Control-Allow-Origin'] = '*';
      //       proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      //       proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
      //     });
      //   },
      // },

      // ⚠️ DEAD CODE - AutoFirma prepare endpoint (signingApi.ts mutat în archive/frontend-old/autofirma-signing/)
      // '/webhook/918cd7f3-c0b6-49da-9218-46723702224d': {
      //   target: 'https://n8n.decaminoservicios.com',
      //   changeOrigin: true,
      //   secure: true,
      //   rewrite: (path) => path,
      //   timeout: 30000, // 30 secunde pentru fișiere mari
      //   headers: {
      //     'Access-Control-Allow-Origin': '*',
      //     'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      //     'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
      //   },
      //   configure: (proxy, options) => {
      //     proxy.on('error', (err, req, res) => {
      //       console.log('autofirma prepare proxy error', err);
      //     });
      //     proxy.on('proxyReq', (proxyReq, req, res) => {
      //       console.log('Sending AutoFirma Prepare Request to:', req.method, req.url);
      //     });
      //     proxy.on('proxyRes', (proxyRes, req, res) => {
      //       console.log('Received AutoFirma Prepare Response:', proxyRes.statusCode, req.url);
      //       // Adaugă CORS headers la răspuns
      //       proxyRes.headers['Access-Control-Allow-Origin'] = '*';
      //       proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      //       proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
      //       // Asigură-te că răspunsul este JSON
      //       proxyRes.headers['Content-Type'] = 'application/json';
      //     });
      //   },
      // },

      // ⚠️ DEAD CODE - getInspecciones migrat la routes.getInspecciones (backend /api/inspecciones)
      // '/webhook/1ef2caab-fa60-4cf2-922d-e9ba2c5ea398': {
      //   target: 'https://n8n.decaminoservicios.com',
      //   changeOrigin: true,
      //   secure: true,
      //   rewrite: (path) => path,
      //   timeout: 10000,
      //   headers: {
      //     'Access-Control-Allow-Origin': '*',
      //     'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      //     'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
      //   },
      //   configure: (proxy, options) => {
      //     proxy.on('error', (err, req, res) => {
      //       console.log('inspecciones proxy error', err);
      //     });
      //     proxy.on('proxyReq', (proxyReq, req, res) => {
      //       console.log('Sending Inspecciones Request to:', req.method, req.url);
      //     });
      //     proxy.on('proxyRes', (proxyRes, req, res) => {
      //       console.log('Received Inspecciones Response:', proxyRes.statusCode, req.url);
      //       // Adaugă CORS headers la răspuns
      //       proxyRes.headers['Access-Control-Allow-Origin'] = '*';
      //       proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      //       proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
      //     });
      //   },
      // },

      // ⚠️ DEAD CODE - downloadInspectionDocument migrat la routes.downloadInspectionDocument (backend /api/inspecciones/download)
      // '/webhook/f4d97660-c73f-45d3-ba3e-dfaf8eefece5': {
      //   target: 'https://n8n.decaminoservicios.com',
      //   changeOrigin: true,
      //   secure: true,
      //   rewrite: (path) => path,
      //   timeout: 15000,
      //   headers: {
      //     'Access-Control-Allow-Origin': '*',
      //     'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      //     'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
      //   },
      //   configure: (proxy, options) => {
      //     proxy.on('error', (err, req, res) => {
      //       console.log('inspection download proxy error', err);
      //     });
      //     proxy.on('proxyReq', (proxyReq, req, res) => {
      //       console.log('Sending Inspection Download Request to:', req.method, req.url);
      //     });
      //     proxy.on('proxyRes', (proxyRes, req, res) => {
      //       console.log('Received Inspection Download Response:', proxyRes.statusCode, req.url);
      //       // Adaugă CORS headers la răspuns
      //       proxyRes.headers['Access-Control-Allow-Origin'] = '*';
      //       proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      //       proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
      //     });
      //   },
      // },

      // ⚠️ DEAD CODE - getUsuarios migrat la routes.getEmpleados (backend)
      // '/webhook/v1/aec36db4-58d4-4175-8429-84d1c487e142': {
      //   target: 'https://n8n.decaminoservicios.com',
      //   changeOrigin: true,
      //   secure: true,
      //   rewrite: (path) => path,
      //   timeout: 10000,
      //   headers: {
      //     'Access-Control-Allow-Origin': '*',
      //     'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      //     'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
      //   },
      //   configure: (proxy, options) => {
      //     proxy.on('error', (err, req, res) => {
      //       console.log('login proxy error', err);
      //     });
      //     proxy.on('proxyReq', (proxyReq, req, res) => {
      //       console.log('Sending Login Request to:', req.method, req.url);
      //     });
      //     proxy.on('proxyRes', (proxyRes, req, res) => {
      //       console.log('Received Login Response:', proxyRes.statusCode, req.url);
      //       // Adaugă CORS headers la răspuns
      //       proxyRes.headers['Access-Control-Allow-Origin'] = '*';
      //       proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      //       proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
      //     });
      //   },
      // },

      // ⚠️ DEAD CODE - AutoFirma webhook endpoint (signingApi.ts mutat în archive/frontend-old/autofirma-signing/)
      // '/webhook/v1/b066b1f7-cc6e-4b9e-a86f-7202a86acab4': {
      //   target: 'https://n8n.decaminoservicios.com',
      //   changeOrigin: true,
      //   secure: true,
      //   rewrite: (path) => path,
      //   timeout: 30000, // 30 secunde pentru fișiere mari
      //   headers: {
      //     'Access-Control-Allow-Origin': '*',
      //     'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      //     'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
      //   },
      //   configure: (proxy, options) => {
      //     proxy.on('error', (err, req, res) => {
      //       console.log('autofirma webhook proxy error', err);
      //     });
      //     proxy.on('proxyReq', (proxyReq, req, res) => {
      //       console.log('Sending AutoFirma Webhook Request to:', req.method, req.url);
      //     });
      //     proxy.on('proxyRes', (proxyRes, req, res) => {
      //       console.log('Received AutoFirma Webhook Response:', proxyRes.statusCode, req.url);
      //       // Adaugă CORS headers la răspuns
      //       proxyRes.headers['Access-Control-Allow-Origin'] = '*';
      //       proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      //       proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
      //     });
      //   },
      // },

      // ⚠️ DEAD CODE - log activity migrat la routes.getActivityLog (backend)
      // '/webhook/v1/log-activity-yyBov0q': {
      //   target: 'https://n8n.decaminoservicios.com',
      //   changeOrigin: true,
      //   secure: true,
      //   rewrite: (path) => path,
      //   timeout: 10000,
      //   headers: {
      //     'Access-Control-Allow-Origin': '*',
      //     'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      //     'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
      //   },
      //   configure: (proxy, options) => {
      //     proxy.on('error', (err, req, res) => {
      //       console.log('log-activity proxy error', err);
      //     });
      //     proxy.on('proxyReq', (proxyReq, req, res) => {
      //       console.log('Sending Log Activity Request to:', req.method, req.url);
      //     });
      //     proxy.on('proxyRes', (proxyRes, req, res) => {
      //       console.log('Received Log Activity Response:', proxyRes.statusCode, req.url);
      //       // Adaugă CORS headers la răspuns
      //       proxyRes.headers['Access-Control-Allow-Origin'] = '*';
      //       proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      //       proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
      //     });
      //   },
      // },

      // ⚠️ DEAD CODE - rejectCambio migrat la routes.rejectCambio (backend)
      // '/webhook/rechazada-a2c3f9cb0ffd': {
      //   target: 'https://n8n.decaminoservicios.com',
      //   changeOrigin: true,
      //   secure: true,
      //   rewrite: (path) => path,
      //   timeout: 10000,
      //   headers: {
      //     'Access-Control-Allow-Origin': '*',
      //     'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      //     'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
      //   },
      //   configure: (proxy, options) => {
      //     proxy.on('error', (err, req, res) => {
      //       console.log('reject-cambio proxy error', err);
      //     });
      //     proxy.on('proxyReq', (proxyReq, req, res) => {
      //       console.log('Sending Reject Cambio Request to:', req.method, req.url);
      //     });
      //     proxy.on('proxyRes', (proxyRes, req, res) => {
      //       console.log('Received Reject Cambio Response:', proxyRes.statusCode, req.url);
      //       // Adaugă CORS headers la răspuns
      //       proxyRes.headers['Access-Control-Allow-Origin'] = '*';
      //       proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      //       proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
      //     });
      //   },
      // },

      // ⚠️ DEAD CODE - login migrat la routes.login (backend)
      // '/webhook/login-yyBov0qVQZEhX2TL': {
      //   target: 'https://n8n.decaminoservicios.com',
      //   changeOrigin: true,
      //   secure: true,
      //   rewrite: (path) => path,
      //   timeout: 10000,
      //   headers: {
      //     'Access-Control-Allow-Origin': '*',
      //     'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      //     'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
      //   },
      //   configure: (proxy, options) => {
      //     proxy.on('error', (err, req, res) => {
      //       console.log('login proxy error', err);
      //     });
      //     proxy.on('proxyReq', (proxyReq, req, res) => {
      //       console.log('Sending Login Request to:', req.method, req.url);
      //     });
      //     proxy.on('proxyRes', (proxyRes, req, res) => {
      //       console.log('Received Login Response:', proxyRes.statusCode, req.url);
      //       // Adaugă CORS headers la răspuns
      //       proxyRes.headers['Access-Control-Allow-Origin'] = '*';
      //       proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      //       proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
      //     });
      //   },
      // },


      // ⚠️ DEAD CODE - downloadDocumentoOficial migrat la routes.downloadDocumentoOficial (backend /api/documentos-oficiales/download)
      // '/webhook/0f16c1e5-b9c6-4bcd-9e1d-2a7c8c62a29f': {
      //   target: 'https://n8n.decaminoservicios.com',
      //   changeOrigin: true,
      //   secure: true,
      //   rewrite: (path) => path,
      //   timeout: 30000,
      //   headers: {
      //     'Access-Control-Allow-Origin': '*',
      //     'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      //     'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
      //   },
      //   configure: (proxy, options) => {
      //     proxy.on('error', (err, req, res) => {
      //       console.log('download documento oficial proxy error', err);
      //     });
      //     proxy.on('proxyReq', (proxyReq, req, res) => {
      //       console.log('Sending Download Documento Oficial Request to:', req.method, req.url);
      //     });
      //     proxy.on('proxyRes', (proxyRes, req, res) => {
      //       console.log('Received Download Documento Oficial Response:', proxyRes.statusCode, req.url);
      //       // Adaugă CORS headers la răspuns
      //       proxyRes.headers['Access-Control-Allow-Origin'] = '*';
      //       proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      //       proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
      //       
      //       // Detectează tipul de fișier din query params și setează Content-Type corespunzător
      //       const url = req.url || '';
      //       if (url.includes('.png') || url.includes('.jpg') || url.includes('.jpeg')) {
      //         const extension = url.match(/\.(png|jpg|jpeg)/i)?.[1]?.toLowerCase();
      //         if (extension === 'png') {
      //           proxyRes.headers['Content-Type'] = 'image/png';
      //         } else if (extension === 'jpg' || extension === 'jpeg') {
      //           proxyRes.headers['Content-Type'] = 'image/jpeg';
      //         }
      //         console.log('🖼️ Image detected, Content-Type set to:', proxyRes.headers['Content-Type']);
      //       } else if (url.includes('.gif')) {
      //         proxyRes.headers['Content-Type'] = 'image/gif';
      //         console.log('🖼️ GIF detected, Content-Type set to: image/gif');
      //       } else if (url.includes('.webp')) {
      //         proxyRes.headers['Content-Type'] = 'image/webp';
      //         console.log('🖼️ WebP detected, Content-Type set to: image/webp');
      //       } else if (url.includes('.pdf')) {
      //         proxyRes.headers['Content-Type'] = 'application/pdf';
      //         console.log('📄 PDF detected, Content-Type set to: application/pdf');
      //       }
      //     });
      //   },
      // },

      // ⚠️ DEAD CODE - getInspecciones migrat la routes.getInspecciones (backend /api/inspecciones)
      // '/webhook/e1590f70-8beb-4c9c-a04c-65fb4d571c90': {
      //   target: 'https://n8n.decaminoservicios.com',
      //   changeOrigin: true,
      //   secure: true,
      //   rewrite: (path) => path,
      //   timeout: 10000,
      //   headers: {
      //     'Access-Control-Allow-Origin': '*',
      //     'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      //     'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
      //   },
      //   configure: (proxy, options) => {
      //     proxy.on('error', (err, req, res) => {
      //       console.log('inspecciones proxy error', err);
      //     });
      //     proxy.on('proxyReq', (proxyReq, req, res) => {
      //       console.log('Sending Inspecciones Request to:', req.method, req.url);
      //     });
      //     proxy.on('proxyRes', (proxyRes, req, res) => {
      //       console.log('Received Inspecciones Response:', proxyRes.statusCode, req.url);
      //       proxyRes.headers['Access-Control-Allow-Origin'] = '*';
      //       proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      //       proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
      //     });
      //   },
      // },



    }
    }
  };
});
