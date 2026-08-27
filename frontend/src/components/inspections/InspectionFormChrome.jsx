import { Button } from '../ui';
import { CheckCircle2, PenLine } from 'lucide-react';

export function FormSection({ title, subtitle, actions, children, className = '' }) {
  return (
    <section className={`inspecciones-form-section app-card app-card--pad ${className}`.trim()}>
      {(title || subtitle || actions) ? (
        <header className="inspecciones-form-section__head">
          <div className="min-w-0">
            {title ? <h2 className="inspecciones-form-section__title">{title}</h2> : null}
            {subtitle ? <p className="inspecciones-form-section__subtitle">{subtitle}</p> : null}
          </div>
          {actions ? <div className="inspecciones-form-section__actions">{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function FormFieldLabel({ icon: Icon, children, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className="inspecciones-form-label">
      {Icon ? <Icon className="inspecciones-form-label__icon" aria-hidden /> : null}
      <span>{children}</span>
    </label>
  );
}

export function SignatureActionCard({
  label,
  signed,
  onClick,
  disabled = false,
  hint,
  error,
}) {
  return (
    <div className="inspecciones-signature-card">
      <p className="inspecciones-signature-card__label">{label}</p>
      <Button
        type="button"
        variant={signed ? 'primary' : 'secondary'}
        size="sm"
        className="w-full min-h-[44px] inspecciones-signature-card__btn"
        onClick={onClick}
        disabled={disabled}
      >
        {signed ? (
          <>
            <CheckCircle2 className="w-4 h-4" aria-hidden />
            Firma agregada
          </>
        ) : (
          <>
            <PenLine className="w-4 h-4" aria-hidden />
            Agregar firma
          </>
        )}
      </Button>
      {hint && !signed ? <p className="inspecciones-form-hint">{hint}</p> : null}
      {error ? <p className="inspecciones-form-error">{error}</p> : null}
    </div>
  );
}
