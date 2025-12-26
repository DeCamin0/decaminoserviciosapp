import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { copyFileSync, mkdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
// DISABLED: vite-plugin-imagemin has 31 vulnerabilities
// import viteImagemin from 'vite-plugin-imagemin'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vitejs.dev/config/
export default defineConfig({
  // Deploy pe subdomeniu la rădăcină → servește din root
  base: '/',
  plugins: [
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
        console.log(`🚀 Building De Camino version: ${buildVersion}`);
        console.log(`==============================\n`);
      },
      closeBundle() {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const stamp = `${now.getFullYear()}.${pad(now.getMonth()+1)}.${pad(now.getDate())}.${pad(now.getHours())}${pad(now.getMinutes())}`;
        const pkgVersion = process.env.npm_package_version || '1.0.0';
        const buildVersion = `${pkgVersion}-${stamp}`;
        console.log(`\n==============================`);
        console.log(`✅ De Camino build completed. Version: ${buildVersion}`);
        console.log(`==============================\n`);
      }
    },
    // Injectează versiunea aplicației în index.html la build
    {
      name: 'inject-html-version',
      transformIndexHtml(html) {
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        const buildVersion = `${now.getFullYear()}.${pad(now.getMonth()+1)}.${pad(now.getDate())}.${pad(now.getHours())}${pad(now.getMinutes())}`;
        return html.replace(/<html([^>]*)data-version="[^"]*"([^>]*)>/,
                            `<html$1 data-version="${buildVersion}"$2>`)
                   .replace(/<html(?![^>]*data-version)([^>]*)>/,
                            `<html$1 data-version="${buildVersion}">`);
      }
    },
    // Plugin PWA cu configurație optimizată pentru a preveni conflicts
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'logo.svg'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Configurație pentru a preveni conflicts
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/webhook\//],
        // Cache strategy pentru a preveni conflicts
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/n8n\.decaminoservicios\.com\/webhook\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 10,
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      },
      manifest: {
        name: 'DE CAMINO SERVICIOS AUXILIARES',
        short_name: 'De Camino',
        description: 'Aplicación web para gestión de empleados y servicios auxiliares',
        theme_color: '#E53935',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait-primary',
        scope: '/',
        start_url: '/',
        lang: 'es',
        categories: ['business', 'productivity'],
        icons: [
          {
            src: 'favicon.ico',
            sizes: '16x16 32x32 48x48',
            type: 'image/x-icon'
          },
          {
            src: 'logo.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
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

        server.middlewares.use('/manifest.json', (req, res) => {
          console.log('🔍 Serving manifest.json via middleware');
          try {
            const filePath = join(process.cwd(), 'public', '/manifest.json');
            if (existsSync(filePath)) {
              const fileContent = readFileSync(filePath);
              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.statusCode = 200;
              res.end(fileContent);
              console.log('✅ manifest.json served successfully');
              return;
            }
          } catch (error) {
            console.error('❌ Error serving manifest.json:', error);
          }
          res.statusCode = 404;
          res.end('Not found');
        });

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
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
    // Variabile de mediu pentru AutoFirma
    'import.meta.env.VITE_SIGNING_MOCK': JSON.stringify('0'), // 0 = AutoFirma reală, 1 = Mock mode
    'import.meta.env.VITE_API_BASE': JSON.stringify(process.env.VITE_N8N_BASE_URL || ''), // Folosește VITE_N8N_BASE_URL din .env.local
    // Fix pentru ExcelJS care încearcă să acceseze _process
    '_process': JSON.stringify({}),
    'process.env': JSON.stringify({}),
  },
  build: {
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
          
          // 6. CAPACITOR - Chunk pentru mobile (300KB) - LAZY LOADING
          if (id.includes('@capacitor/')) {
            return 'capacitor';
          }
          
          // 7. FORM LIBRARIES - Chunk pentru formulare (150KB)
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
        target: 'https://n8n.decaminoservicios.com',
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
      'Permissions-Policy': 'unload=*, geolocation=*',
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
    proxy: {
      '/webhook': {
        target: 'https://n8n.decaminoservicios.com',
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

      '/webhook-test': {
        target: 'https://n8n.decaminoservicios.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path,
        timeout: 30000, // 30 secunde timeout pentru teste
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
        },
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('webhook-test proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Sending Test Request to:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('Received Test Response:', proxyRes.statusCode, req.url);
            // Adaugă CORS headers la răspuns
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
            proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
          });
        },
      },

      '/webhook/getavatar': {
        target: 'https://n8n.decaminoservicios.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path,
        timeout: 30000,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
        },
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('getavatar proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Sending Avatar Request to:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('Received Avatar Response:', proxyRes.statusCode, req.url);
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
            proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
          });
        },
      },

      '/contracts': {
        target: 'https://n8n.decaminoservicios.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => {
          // Pentru GET requests, folosește endpoint-ul de test pentru afișare
          if (path.includes('?nif=')) {
            return path.replace(/^\/contracts/, '/webhook/8e669710-0850-4b9b-b48e-fc19d09e4841');
          }
          // Pentru POST requests, folosește endpoint-ul de producție pentru upload
          return path.replace(/^\/contracts/, '/webhook/f1535e89-f74b-4df3-8516-5dfdda8c6b35');
        },
        timeout: 30000, // 30 secunde pentru fișiere mari
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('contracts proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Sending Contract Request to:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('Received Download Contract Response:', proxyRes.statusCode, req.url);
          });
        },
      },
      '/download-contract': {
        target: 'https://n8n.decaminoservicios.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/download-contract/, '/webhook/6cb6b98c-9127-494c-8201-f097d14b9c13'),
        timeout: 30000, // 30 secunde pentru fișiere mari
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('download-contract proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Sending Download Contract Request to:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('Received Download Contract Response:', proxyRes.statusCode, req.url);
          });
        },
      },
      '/api/n8n': {
        target: 'https://n8n.decaminoservicios.com',
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

      // Proxy specific pentru documentos oficiales
      '/webhook/171d8236-6ef1-4b97-8605-096476bc1d8b': {
        target: 'https://n8n.decaminoservicios.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path,
        timeout: 10000,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
        },
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('documentos oficiales proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Sending Documentos Oficiales Request to:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('Received Documentos Oficiales Response:', proxyRes.statusCode, req.url);
            // Adaugă CORS headers la răspuns
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
            proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
          });
        },
      },

      // Proxy pentru AutoFirma prepare endpoint
      '/webhook/918cd7f3-c0b6-49da-9218-46723702224d': {
        target: 'https://n8n.decaminoservicios.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path,
        timeout: 30000, // 30 secunde pentru fișiere mari
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
        },
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('autofirma prepare proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Sending AutoFirma Prepare Request to:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('Received AutoFirma Prepare Response:', proxyRes.statusCode, req.url);
            // Adaugă CORS headers la răspuns
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
            proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
            // Asigură-te că răspunsul este JSON
            proxyRes.headers['Content-Type'] = 'application/json';
          });
        },
      },

      // Proxy pentru inspecții endpoint
      '/webhook/1ef2caab-fa60-4cf2-922d-e9ba2c5ea398': {
        target: 'https://n8n.decaminoservicios.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path,
        timeout: 10000,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
        },
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('inspecciones proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Sending Inspecciones Request to:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('Received Inspecciones Response:', proxyRes.statusCode, req.url);
            // Adaugă CORS headers la răspuns
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
            proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
          });
        },
      },

      // Proxy pentru descărcarea documentelor inspecții
      '/webhook/f4d97660-c73f-45d3-ba3e-dfaf8eefece5': {
        target: 'https://n8n.decaminoservicios.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path,
        timeout: 15000,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
        },
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('inspection download proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Sending Inspection Download Request to:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('Received Inspection Download Response:', proxyRes.statusCode, req.url);
            // Adaugă CORS headers la răspuns
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
            proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
          });
        },
      },

      // Proxy pentru login și utilizatori endpoint (v1)
      '/webhook/v1/aec36db4-58d4-4175-8429-84d1c487e142': {
        target: 'https://n8n.decaminoservicios.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path,
        timeout: 10000,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
        },
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('login proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Sending Login Request to:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('Received Login Response:', proxyRes.statusCode, req.url);
            // Adaugă CORS headers la răspuns
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
            proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
          });
        },
      },

      // Proxy pentru autofirma webhook endpoint
      '/webhook/v1/b066b1f7-cc6e-4b9e-a86f-7202a86acab4': {
        target: 'https://n8n.decaminoservicios.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path,
        timeout: 30000, // 30 secunde pentru fișiere mari
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
        },
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('autofirma webhook proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Sending AutoFirma Webhook Request to:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('Received AutoFirma Webhook Response:', proxyRes.statusCode, req.url);
            // Adaugă CORS headers la răspuns
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
            proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
          });
        },
      },

      // Proxy pentru log activity endpoint
      '/webhook/v1/log-activity-yyBov0q': {
        target: 'https://n8n.decaminoservicios.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path,
        timeout: 10000,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
        },
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('log-activity proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Sending Log Activity Request to:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('Received Log Activity Response:', proxyRes.statusCode, req.url);
            // Adaugă CORS headers la răspuns
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
            proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
          });
        },
      },

      // Proxy pentru reject cambio endpoint
      '/webhook/rechazada-a2c3f9cb0ffd': {
        target: 'https://n8n.decaminoservicios.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path,
        timeout: 10000,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
        },
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('reject-cambio proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Sending Reject Cambio Request to:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('Received Reject Cambio Response:', proxyRes.statusCode, req.url);
            // Adaugă CORS headers la răspuns
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
            proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
          });
        },
      },

      // Proxy pentru login endpoint
      '/webhook/login-yyBov0qVQZEhX2TL': {
        target: 'https://n8n.decaminoservicios.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path,
        timeout: 10000,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
        },
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('login proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Sending Login Request to:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('Received Login Response:', proxyRes.statusCode, req.url);
            // Adaugă CORS headers la răspuns
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
            proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
          });
        },
      },


      // Proxy pentru download documento oficial
      '/webhook/0f16c1e5-b9c6-4bcd-9e1d-2a7c8c62a29f': {
        target: 'https://n8n.decaminoservicios.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path,
        timeout: 30000,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
        },
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('download documento oficial proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Sending Download Documento Oficial Request to:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('Received Download Documento Oficial Response:', proxyRes.statusCode, req.url);
            // Adaugă CORS headers la răspuns
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
            proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
            
            // Detectează tipul de fișier din query params și setează Content-Type corespunzător
            const url = req.url || '';
            if (url.includes('.png') || url.includes('.jpg') || url.includes('.jpeg')) {
              const extension = url.match(/\.(png|jpg|jpeg)/i)?.[1]?.toLowerCase();
              if (extension === 'png') {
                proxyRes.headers['Content-Type'] = 'image/png';
              } else if (extension === 'jpg' || extension === 'jpeg') {
                proxyRes.headers['Content-Type'] = 'image/jpeg';
              }
              console.log('🖼️ Image detected, Content-Type set to:', proxyRes.headers['Content-Type']);
            } else if (url.includes('.gif')) {
              proxyRes.headers['Content-Type'] = 'image/gif';
              console.log('🖼️ GIF detected, Content-Type set to: image/gif');
            } else if (url.includes('.webp')) {
              proxyRes.headers['Content-Type'] = 'image/webp';
              console.log('🖼️ WebP detected, Content-Type set to: image/webp');
            } else if (url.includes('.pdf')) {
              proxyRes.headers['Content-Type'] = 'application/pdf';
              console.log('📄 PDF detected, Content-Type set to: application/pdf');
            }
          });
        },
      },

      // Proxy pentru inspecciones endpoint nuevo
      '/webhook/e1590f70-8beb-4c9c-a04c-65fb4d571c90': {
        target: 'https://n8n.decaminoservicios.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path,
        timeout: 10000,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With'
        },
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('inspecciones proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Sending Inspecciones Request to:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('Received Inspecciones Response:', proxyRes.statusCode, req.url);
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
            proxyRes.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With';
          });
        },
      },



    }
  }
})
