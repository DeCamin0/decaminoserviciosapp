import { useMemo } from 'react';
import { config } from '../../config/env.js';
import Footer from '../Footer';
import { portalIsClient2 } from './portalAuthChromeUtils.js';

function logoSrc() {
  const base = `${(config.BASE_PATH || '/')}${config.LOGO_PATH || 'logo.svg'}`.replace(
    /\/+/g,
    '/',
  );
  if (typeof window !== 'undefined' && window.location.hostname.includes('ngrok')) {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iNDAiIGN5PSI0MCIgcj0iNDAiIGZpbGw9IiNFRTM5MzUiLz4KPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyOCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+REM8L3RleHQ+Cjwvc3ZnPgo=';
  }
  return base;
}

/**
 * Cliente/comunidad del token portal (no confundir con la marca legal del operador).
 * @typedef {{ name: string; nif?: string | null; id?: number | null }} ActivePortalClient
 */

function PortalActiveClientHeader({ isClient2, activePortalClient }) {
  const legal = config.COMPANY_NAME_LEGAL || config.COMPANY_NAME || '';
  const name = activePortalClient?.name?.trim();
  if (!name) {
    return (
      <p
        className={`text-sm font-medium ${isClient2 ? 'text-gray-600' : 'text-white/70'}`}
      >
        {legal}
      </p>
    );
  }
  const boxClass = isClient2
    ? 'mt-2 rounded-xl border-2 border-amber-500/70 bg-amber-50 text-gray-900 px-3 py-2.5 text-left mx-auto max-w-md shadow-sm'
    : 'mt-2 rounded-xl border-2 border-white/60 bg-white/12 text-white px-3 py-2.5 text-left mx-auto max-w-md backdrop-blur-sm';
  return (
    <div className="space-y-2">
      <div className={boxClass}>
        <p
          className={`text-[10px] font-bold uppercase tracking-wider ${isClient2 ? 'text-amber-900/80' : 'text-white/80'}`}
        >
          Comunidad / cliente activo
        </p>
        <p className={`text-base font-bold leading-snug ${isClient2 ? 'text-gray-900' : 'text-white'}`}>
          {name}
        </p>
        {activePortalClient?.nif ? (
          <p className={`text-xs mt-0.5 ${isClient2 ? 'text-gray-700' : 'text-white/85'}`}>
            NIF / CIF: <span className="font-mono font-semibold">{activePortalClient.nif}</span>
          </p>
        ) : null}
        {activePortalClient?.id != null && Number.isFinite(activePortalClient.id) ? (
          <p className={`text-[10px] mt-1 ${isClient2 ? 'text-gray-500' : 'text-white/55'}`}>
            Ref. interna cliente: {activePortalClient.id}
          </p>
        ) : null}
      </div>
      {legal ? (
        <p
          className={`text-[11px] ${isClient2 ? 'text-gray-500' : 'text-white/55'} px-1`}
        >
          Portal ofrecido por: <span className="font-medium">{legal}</span>
        </p>
      ) : null}
    </div>
  );
}

/**
 * Misma estética que la pantalla de login (fondo, logo, titulares, tarjeta glass).
 */
export default function PortalAuthChrome({
  cardTitle,
  cardSubtitle = '',
  children,
  footerNote = null,
  /** Comunidad del JWT (`/api/portal/me`): evita confundirla con el nombre legal del operador arriba. */
  activePortalClient = null,
  /** Panel autenticado: ancho útil (hasta ~1440px) en lugar de tarjeta móvil estrecha. */
  wideContent = false,
}) {
  const primaryFallback =
    config.PRIMARY_COLOR && config.PRIMARY_COLOR.trim()
      ? config.PRIMARY_COLOR.startsWith('#')
        ? config.PRIMARY_COLOR
        : `#${config.PRIMARY_COLOR}`
      : '#2563A8';
  const isClient2 = portalIsClient2();
  const logoContainerClass = isClient2
    ? 'w-40 h-28 bg-white/30 backdrop-blur-md rounded-xl flex items-center justify-center shadow-2xl border border-white/40 group-hover:border-[var(--primary-color)]/70 transition-all duration-500'
    : 'w-28 h-28 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center shadow-2xl border border-white/40 group-hover:border-[var(--primary-color)]/70 transition-all duration-500';
  const logoGlowClass = isClient2
    ? 'absolute inset-0 w-40 h-28 bg-gradient-to-r from-[var(--primary-color)]/40 to-[var(--primary-color-darkest)]/40 rounded-xl blur-xl animate-glow group-hover:from-[var(--primary-color)]/60 group-hover:to-[var(--primary-color)]/60 transition-all duration-500'
    : 'absolute inset-0 w-28 h-28 bg-gradient-to-r from-[var(--primary-color)]/40 to-[var(--primary-color-darkest)]/40 rounded-full blur-xl animate-glow group-hover:from-[var(--primary-color)]/60 group-hover:to-[var(--primary-color)]/60 transition-all duration-500';
  const loginBgStyle = isClient2
    ? { background: 'linear-gradient(160deg, #C5DCF0 0%, #A8CDE8 50%, #7EB8DD 100%)' }
    : { backgroundColor: `var(--primary-color, ${primaryFallback})` };

  const brandWords = useMemo(() => {
    const n = config.COMPANY_NAME || config.APP_NAME || 'DE CAMINO';
    return n.split(' ').slice(0, 2).join(' ');
  }, []);

  const externalUrl = config.EXTERNAL_SITE_URL || 'https://decaminoservicios.com';

  return (
    <div className="min-h-screen relative overflow-hidden" style={loginBgStyle}>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px var(--primary-color-rgba-04, rgba(239, 68, 68, 0.4)); }
          50% { box-shadow: 0 0 40px var(--primary-color-rgba-06, rgba(239, 68, 68, 0.8)); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes textFloat {
          0%, 100% { transform: perspective(1000px) rotateX(15deg) translateY(0px) rotateZ(0deg); }
          50% { transform: perspective(1000px) rotateX(10deg) translateY(-10px) rotateZ(-1deg); }
        }
        @keyframes textGlow {
          0%, 100% {
            text-shadow: 0 0 20px rgba(255, 255, 255, 0.8), 0 0 40px var(--primary-color-rgba-06), 0 0 60px var(--primary-color-rgba-04);
            filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.5));
          }
          50% {
            text-shadow: 0 0 30px rgba(255, 255, 255, 1), 0 0 60px var(--primary-color-rgba-06);
            filter: drop-shadow(0 0 15px rgba(255, 255, 255, 0.8));
          }
        }
        @keyframes shadowFloat {
          0%, 100% { transform: translate(4px, 4px) perspective(1000px) rotateX(15deg) scale(1); }
          50% { transform: translate(6px, 6px) perspective(1000px) rotateX(20deg) scale(1.02); }
        }
        @keyframes particleMove {
          0% { transform: translateX(-100%) translateY(-100%) rotate(0deg); opacity: 0; }
          25% { opacity: 1; }
          100% { transform: translateX(200%) translateY(100%) rotate(360deg); opacity: 0; }
        }
        @keyframes ripple {
          0% { width: 0; height: 0; opacity: 1; }
          100% { width: 200px; height: 200px; opacity: 0; }
        }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-glow { animation: glow 2s ease-in-out infinite; }
        .animate-shimmer { animation: shimmer 2s infinite; }
      `}</style>

      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--primary-color)]/30 via-[var(--primary-color)]/20 to-[var(--primary-color-darkest)]/30" />
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-gradient-to-r from-[var(--primary-color)]/25 to-[var(--primary-color-darkest)]/25 rounded-full blur-3xl animate-float" />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-r from-[var(--primary-color)]/20 to-[var(--primary-color-darkest)]/20 rounded-full blur-3xl animate-float"
          style={{ animationDelay: '2s' }}
        />
      </div>

      <div
        className={`relative z-10 min-h-screen flex flex-col px-3 sm:px-5 lg:px-10 ${
          wideContent ? 'py-6 sm:py-8' : 'py-10'
        }`}
      >
        <div
          className={`w-full mx-auto flex-1 flex flex-col ${
            wideContent ? 'max-w-[min(100%,1440px)]' : 'max-w-md'
          }`}
        >
          <div className={`text-center ${wideContent ? 'mb-4 sm:mb-5' : 'mb-8'}`}>
            {isClient2 ? (
              <>
                <div
                  className={`flex justify-center ${wideContent ? 'mb-4' : 'mb-8'}`}
                >
                  <a
                    href={externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block focus:outline-none transition transform hover:scale-[1.02]"
                    title={config.COMPANY_NAME}
                  >
                    <img
                      src={logoSrc()}
                      alt={`${config.COMPANY_NAME} Logo`}
                      className="h-24 w-auto max-w-[340px] object-contain drop-shadow-[0_2px_12px_rgba(0,0,0,0.15)]"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  </a>
                </div>
                <div className="space-y-4">
                  <h1 className="text-5xl sm:text-6xl font-black mb-2 relative group">
                    <span
                      className="inline-block"
                      style={{
                        background:
                          'linear-gradient(45deg, var(--primary-color-darkest), var(--primary-color), var(--primary-color-darker), #1e3a5f, var(--primary-color), var(--primary-color-darkest))',
                        backgroundSize: '400% 400%',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        animation: 'gradientShift 2s ease-in-out infinite, textFloat 4s ease-in-out infinite',
                      }}
                    >
                      {brandWords}
                    </span>
                  </h1>
                  <div className="w-24 h-1 bg-gradient-to-r from-[var(--primary-color)]/60 via-[var(--primary-color)] to-[var(--primary-color)]/60 mx-auto rounded-full" />
                  <h2 className="text-xl font-semibold text-gray-700 mb-1">Portal clientes</h2>
                  <PortalActiveClientHeader
                    isClient2={isClient2}
                    activePortalClient={activePortalClient}
                  />
                </div>
              </>
            ) : (
              <>
                <div
                  className={`flex justify-center ${wideContent ? 'mb-4' : 'mb-8'}`}
                >
                  <a
                    href={externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="relative group transition-all duration-500 transform hover:scale-110 hover:rotate-3"
                    title={config.COMPANY_NAME}
                  >
                    <div className="relative">
                      <div className={logoContainerClass}>
                        <img
                          src={logoSrc()}
                          alt={`${config.COMPANY_NAME || 'App'} Logo`}
                          className="h-20 w-20 object-contain group-hover:scale-110 transition-transform duration-500"
                          onError={(e) => {
                            e.target.style.display = 'none';
                            const el = e.target.nextSibling;
                            if (el) el.style.display = 'block';
                          }}
                        />
                        <div className="hidden text-white font-bold text-2xl">DC</div>
                      </div>
                      <div className={logoGlowClass} />
                    </div>
                  </a>
                </div>
                <div className="space-y-4">
                  <h1 className="text-5xl sm:text-6xl font-black mb-2 relative group">
                    <span
                      className="inline-block transform group-hover:scale-110 transition-all duration-700"
                      style={{
                        background:
                          'linear-gradient(45deg, #ffffff, var(--primary-color), var(--primary-color-darker), var(--primary-color-darkest), var(--primary-color), #ffffff)',
                        backgroundSize: '400% 400%',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        animation:
                          'gradientShift 2s ease-in-out infinite, textFloat 4s ease-in-out infinite, textGlow 3s ease-in-out infinite',
                        transform: 'perspective(1000px) rotateX(15deg)',
                        transformStyle: 'preserve-3d',
                      }}
                    >
                      {brandWords}
                    </span>
                    <span
                      className="absolute inset-0 text-5xl sm:text-6xl font-black opacity-40 blur-md pointer-events-none"
                      style={{
                        background:
                          'linear-gradient(45deg, #ffffff, var(--primary-color), var(--primary-color-darker), var(--primary-color-darkest))',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        transform: 'translate(4px, 4px) perspective(1000px) rotateX(15deg)',
                        zIndex: -1,
                        animation: 'shadowFloat 4s ease-in-out infinite',
                      }}
                    >
                      {brandWords}
                    </span>
                  </h1>
                  <div className="w-24 h-1 bg-gradient-to-r from-white via-[var(--primary-color)] to-white mx-auto rounded-full" />
                  <h2 className="text-xl font-semibold text-white/90 mb-1">Portal clientes</h2>
                  <PortalActiveClientHeader
                    isClient2={isClient2}
                    activePortalClient={activePortalClient}
                  />
                </div>
              </>
            )}
          </div>

          <div className="relative flex-1 w-full min-w-0">
            <div className="absolute inset-0 bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl" />
            <div
              className={`relative w-full min-w-0 ${
                wideContent ? 'p-4 sm:p-6 lg:p-8' : 'p-6 sm:p-8'
              }`}
            >
              <div className={`text-center ${wideContent ? 'mb-4' : 'mb-6'}`}>
                <h3
                  className={`text-2xl font-bold mb-2 ${isClient2 ? 'text-gray-900' : 'text-white'}`}
                >
                  {cardTitle}
                </h3>
                {cardSubtitle ? (
                  <p className={isClient2 ? 'text-gray-600 text-sm' : 'text-gray-400 text-sm'}>
                    {cardSubtitle}
                  </p>
                ) : null}
              </div>
              {children}
              {footerNote ? (
                <p
                  className={`mt-6 text-xs text-center leading-relaxed ${isClient2 ? 'text-gray-600' : 'text-white/60'}`}
                >
                  {footerNote}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-8">
            <Footer />
          </div>
          <div className="text-center mt-6 pb-4">
            <div
              className={`inline-flex items-center flex-wrap justify-center gap-x-2 gap-y-1 text-xs ${isClient2 ? 'text-gray-900 font-bold' : 'text-gray-400'}`}
            >
              <span>© {new Date().getFullYear()}</span>
              <span className={`w-1 h-1 rounded-full ${isClient2 ? 'bg-gray-700' : 'bg-gray-400'}`} />
              <span>{config.COMPANY_NAME || config.COMPANY_NAME_LEGAL || ''}</span>
              <span className={`w-1 h-1 rounded-full ${isClient2 ? 'bg-gray-700' : 'bg-gray-400'}`} />
              <span>Área de clientes</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Botón primario alineado con el login (gradiente marca). */
export function PortalPrimaryButton({ children, className = '', ...props }) {
  return (
    <button
      type="button"
      className={`group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-[var(--primary-color)] to-[var(--primary-color-darkest)] p-[2px] transition-all duration-300 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...props}
    >
      <span className="relative flex items-center justify-center px-6 py-3.5 rounded-[10px] bg-gradient-to-r from-[var(--primary-color)] to-[var(--primary-color-darkest)] text-white font-semibold w-full min-h-[48px]">
        {children}
      </span>
      <span className="absolute inset-0 -top-[50%] -left-[50%] w-[200%] h-[200%] bg-gradient-to-r from-transparent via-white/20 to-transparent rotate-45 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 pointer-events-none animate-shimmer" />
    </button>
  );
}

export function PortalGhostButton({ children, className = '', ...props }) {
  const isClient2 = portalIsClient2();
  const cls = isClient2
    ? 'w-full py-3 rounded-xl text-sm font-medium text-gray-800 border border-gray-300 bg-white/70 hover:bg-white transition-colors'
    : 'w-full py-3 rounded-xl text-sm font-medium text-white/90 border border-white/30 hover:bg-white/10 transition-colors';
  return (
    <button type="button" className={`${cls} ${className}`} {...props}>
      {children}
    </button>
  );
}
