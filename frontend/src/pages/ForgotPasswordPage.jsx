import { useState } from 'react';
import { Link } from 'react-router';
import { config } from '../config/env.js';
import { routes } from '../utils/routes.js';
import './LoginPage.css';

const GENERIC_OK =
  'Si existe una cuenta asociada a este correo, recibirás instrucciones para restablecer tu contraseña.';

function buildLogoSrc() {
  return `${config.BASE_PATH || '/'}${config.LOGO_PATH || 'logo.svg'}`.replace(
    /\/+/g,
    '/',
  );
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch(routes.forgotPassword, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 429) {
        setError(
          data.message ||
            'Demasiadas solicitudes. Espera unos minutos e inténtalo de nuevo.',
        );
        return;
      }
      setDone(true);
    } catch {
      setDone(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page" data-login-contrast="dark">
      <div className="login-page__content">
        <header className="login-brand">
          <div className="login-brand__logo-wrap" style={{ margin: '0 auto 1.25rem' }}>
            <img src={buildLogoSrc()} alt="" className="login-brand__logo" />
          </div>
          <h1 className="login-brand__title">¿Has olvidado tu contraseña?</h1>
          <div className="login-brand__accent" aria-hidden="true" />
          <p className="login-brand__company">
            Introduce el correo de tu cuenta. Si está registrado, te enviaremos un
            enlace para elegir una nueva contraseña.
          </p>
        </header>

        <div className="login-card">
          {done ? (
            <div role="status" className="login-alert" style={{ marginBottom: 0 }}>
              <div>{GENERIC_OK}</div>
              <p className="login-terms" style={{ marginTop: '1rem' }}>
                <Link to="/login">Volver al inicio de sesión</Link>
              </p>
            </div>
          ) : (
            <form className="login-form" onSubmit={onSubmit} noValidate>
              {error ? (
                <div role="alert" className="login-alert">
                  <div>{error}</div>
                </div>
              ) : null}
              <div className="login-field">
                <label htmlFor="forgot-email">Correo electrónico</label>
                <div className="login-field__control">
                  <input
                    id="forgot-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(ev) => setEmail(ev.target.value)}
                    required
                    placeholder="tu@email.com"
                  />
                </div>
              </div>
              <button
                type="submit"
                className="login-btn login-btn--primary"
                disabled={submitting}
              >
                {submitting ? 'Enviando…' : 'Enviar instrucciones'}
              </button>
              <p className="login-terms" style={{ marginTop: '1rem' }}>
                <Link to="/login">Volver al inicio de sesión</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
