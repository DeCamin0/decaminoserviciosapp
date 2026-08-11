import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContextBase';
import Footer from '../components/Footer';
import DemoModal from '../components/DemoModal';
import { isDemoMode } from '../utils/demo';
import { config } from '../config/env.js';
import './LoginPage.css';

function normalizeHex(raw) {
  if (!raw || typeof raw !== 'string') return '';
  const value = raw.trim();
  if (!value) return '';
  return value.startsWith('#') ? value : `#${value}`;
}

function parseHexToRgb(hex) {
  const normalized = normalizeHex(hex).replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized) && !/^[0-9a-fA-F]{3}$/.test(normalized)) {
    return null;
  }
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** Relative luminance (sRGB) — used only for generic light/dark contrast. */
function relativeLuminance({ r, g, b }) {
  const toLinear = (channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const R = toLinear(r);
  const G = toLinear(g);
  const B = toLinear(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function buildLogoSrc() {
  return `${config.BASE_PATH || '/'}${config.LOGO_PATH || 'logo.svg'}`.replace(/\/+/g, '/');
}

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const now = useMemo(() => new Date(), []);
  const isHolidaySeason = now.getMonth() === 11 || (now.getMonth() === 0 && now.getDate() <= 6);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);

  const companyLabel = config.COMPANY_NAME || config.COMPANY_NAME_LEGAL || config.APP_NAME || '';
  const brandTitle = useMemo(() => {
    const source = (config.APP_NAME || config.COMPANY_NAME || '').trim();
    if (!source) return '';
    const parts = source.split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).join(' ') || source;
  }, []);

  const loginContrast = useMemo(() => {
    const rgb = parseHexToRgb(config.PRIMARY_COLOR);
    if (!rgb) return 'dark';
    return relativeLuminance(rgb) > 0.55 ? 'light' : 'dark';
  }, []);

  const logoSrc = useMemo(() => buildLogoSrc(), []);
  const appVersion =
    typeof document !== 'undefined'
      ? document.documentElement.getAttribute('data-version') || config.APP_VERSION || '—'
      : config.APP_VERSION || '—';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(formData.email, formData.password);

    if (result.success) {
      const redirectPath = sessionStorage.getItem('redirectAfterLogin');
      if (redirectPath && redirectPath !== '/login') {
        sessionStorage.removeItem('redirectAfterLogin');
        navigate(redirectPath, { replace: true });
      } else {
        navigate('/inicio', { replace: true });
      }
    } else {
      setError(result.error);
    }

    setLoading(false);
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleDemoMode = () => {
    setShowDemoModal(true);
  };

  return (
    <div className="login-page" data-login-contrast={loginContrast}>
      <div className="login-page__ambient" aria-hidden="true">
        <div className="login-page__orb login-page__orb--a" />
        <div className="login-page__orb login-page__orb--b" />
      </div>

      {isHolidaySeason && (
        <div className="login-season" aria-hidden="true">
          {Array.from({ length: 18 }).map((_, idx) => (
            <span
              key={idx}
              className="login-season__flake"
              style={{
                left: `${(idx * 100) / 18}%`,
                animationDuration: `${8 + (idx % 5)}s`,
                animationDelay: `${idx * 0.35}s`,
                width: `${3 + (idx % 3)}px`,
                height: `${3 + (idx % 3)}px`,
              }}
            />
          ))}
        </div>
      )}

      <div className="login-page__content">
        <header className="login-brand">
          {config.EXTERNAL_SITE_URL ? (
            <a
              href={config.EXTERNAL_SITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="login-brand__logo-link"
              title={companyLabel ? `Visita ${companyLabel}` : undefined}
            >
              <div className="login-brand__logo-wrap">
                <img
                  src={logoSrc}
                  alt={companyLabel ? `${companyLabel} Logo` : 'Logo'}
                  className="login-brand__logo"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            </a>
          ) : (
            <div className="login-brand__logo-wrap" style={{ margin: '0 auto 1.25rem' }}>
              <img
                src={logoSrc}
                alt={companyLabel ? `${companyLabel} Logo` : 'Logo'}
                className="login-brand__logo"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
          )}

          {brandTitle ? <h1 className="login-brand__title">{brandTitle}</h1> : null}
          <div className="login-brand__accent" aria-hidden="true" />
          <h2 className="login-brand__subtitle">Portal Empresarial</h2>
          {companyLabel ? <p className="login-brand__company">{companyLabel}</p> : null}
        </header>

        <div className="login-card">
          <div className="login-card__header">
            <h3 className="login-card__title">Iniciar Sesión</h3>
            <p className="login-card__desc">Accede a tu cuenta empresarial</p>
          </div>

          <form
            className="login-form"
            name="decamino-login"
            autoComplete="on"
            data-password-manager-title="DeCamino"
            onSubmit={handleSubmit}
          >
            {error && (
              <div role="alert" className="login-alert">
                <svg fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>{error}</div>
              </div>
            )}

            <div className="login-field">
              <label htmlFor="login-email">Correo Electrónico</label>
              <div className="login-field__control">
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  required
                  autoComplete="username"
                  placeholder="tu@email.com"
                />
                <span className="login-field__icon" aria-hidden="true">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                    />
                  </svg>
                </span>
              </div>
            </div>

            <div className="login-field">
              <label htmlFor="login-password">Contraseña</label>
              <div className="login-field__control">
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="login-field__toggle"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? (
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21"
                      />
                    </svg>
                  ) : (
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <p className="login-terms">
              Al iniciar sesión, estás de acuerdo con los{' '}
              <a
                href={`${config.EXTERNAL_SITE_URL}/es/terminos/`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Términos y Condiciones
              </a>
            </p>

            <button type="submit" disabled={loading} className="login-btn login-btn--primary">
              {loading ? (
                <>
                  <span className="login-btn__spinner" aria-hidden="true" />
                  <span>Iniciando sesión...</span>
                </>
              ) : (
                <span>Iniciar Sesión</span>
              )}
            </button>

            <p className="login-hint">
              📍 La ubicación se solicita al iniciar sesión y solo se utiliza al fichar.
            </p>

            {!isDemoMode() && (
              <div className="login-demo">
                <div className="login-demo__divider">o</div>
                <button
                  type="button"
                  onClick={handleDemoMode}
                  className="login-btn login-btn--secondary"
                >
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  <span>Conéctate como DEMO</span>
                </button>
                <p className="login-demo__hint">Explora la aplicación con datos simulados</p>
              </div>
            )}
          </form>
        </div>

        <div className="login-page__footer">
          <Footer />
          <div className="login-page__meta">
            <span>© {new Date().getFullYear()}</span>
            <span className="login-page__meta-dot" aria-hidden="true" />
            {companyLabel ? <span>{companyLabel}</span> : null}
            {companyLabel ? <span className="login-page__meta-dot" aria-hidden="true" /> : null}
            <span>Sistema de gestión empresarial</span>
            <span className="login-page__meta-dot" aria-hidden="true" />
            <span className="login-page__meta-version">v{appVersion}</span>
          </div>
        </div>
      </div>

      <DemoModal isOpen={showDemoModal} onClose={() => setShowDemoModal(false)} />
    </div>
  );
}
