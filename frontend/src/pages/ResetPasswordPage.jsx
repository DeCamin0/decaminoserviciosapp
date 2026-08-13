import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { config } from '../config/env.js';
import { routes } from '../utils/routes.js';
import './LoginPage.css';

function buildLogoSrc() {
  return `${config.BASE_PATH || '/'}${config.LOGO_PATH || 'logo.svg'}`.replace(
    /\/+/g,
    '/',
  );
}

function validateClientPassword(password) {
  if (!password || password.length < 9) {
    return 'La nueva contraseña debe tener al menos 9 caracteres (se recomienda 12)';
  }
  if (password.length > 100) {
    return 'La nueva contraseña no puede tener más de 100 caracteres';
  }
  const errors = [];
  if (!/[A-Z]/.test(password)) errors.push('1 mayúscula');
  if (!/[a-z]/.test(password)) errors.push('1 minúscula');
  if (!/[0-9]/.test(password)) errors.push('1 número');
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push('1 carácter especial');
  }
  if (errors.length) {
    return `La nueva contraseña debe contener: ${errors.join(', ')}`;
  }
  return null;
}

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = useMemo(() => (params.get('token') || '').trim(), [params]);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (!token) {
      setError('Enlace no válido o caducado.');
      return;
    }
    const complexityError = validateClientPassword(newPassword);
    if (complexityError) {
      setError(complexityError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('La contraseña y la confirmación no coinciden');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(routes.resetPasswordSelf, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword, confirmPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data.message || data.error || 'No se pudo restablecer la contraseña.',
        );
        return;
      }
      navigate('/login?reset=ok', { replace: true });
    } catch {
      setError('No se pudo conectar. Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="login-page" data-login-contrast="dark">
        <div className="login-page__content">
          <div className="login-card">
            <div className="login-card__header">
              <h3 className="login-card__title">Enlace no válido</h3>
              <p className="login-card__desc">
                Este enlace de recuperación no es válido o ha caducado.
              </p>
            </div>
            <p className="login-terms">
              <Link to="/olvidar-contrasena">Solicitar nuevo enlace</Link>
              {' · '}
              <Link to="/login">Volver al login</Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page" data-login-contrast="dark">
      <div className="login-page__content">
        <header className="login-brand">
          <div className="login-brand__logo-wrap" style={{ margin: '0 auto 1.25rem' }}>
            <img src={buildLogoSrc()} alt="" className="login-brand__logo" />
          </div>
          <h1 className="login-brand__title">Nueva contraseña</h1>
          <div className="login-brand__accent" aria-hidden="true" />
          <p className="login-brand__company">
            Elige una contraseña nueva y confírmala. El enlace es de un solo uso.
          </p>
        </header>

        <div className="login-card">
          <form className="login-form" onSubmit={onSubmit} noValidate>
            {error ? (
              <div role="alert" className="login-alert">
                <div>{error}</div>
              </div>
            ) : null}
            <div className="login-field">
              <label htmlFor="reset-new">Nueva contraseña</label>
              <div className="login-field__control">
                <input
                  id="reset-new"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(ev) => setNewPassword(ev.target.value)}
                  required
                />
              </div>
            </div>
            <div className="login-field">
              <label htmlFor="reset-confirm">Confirmar contraseña</label>
              <div className="login-field__control">
                <input
                  id="reset-confirm"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(ev) => setConfirmPassword(ev.target.value)}
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              className="login-btn login-btn--primary"
              disabled={submitting}
            >
              {submitting ? 'Guardando…' : 'Guardar contraseña'}
            </button>
            <p className="login-terms" style={{ marginTop: '1rem' }}>
              <Link to="/login">Volver al inicio de sesión</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
