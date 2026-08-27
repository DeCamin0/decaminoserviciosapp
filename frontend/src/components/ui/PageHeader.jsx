import { Link } from 'react-router';

export default function PageHeader({
  title,
  subtitle,
  backTo,
  backTitle = 'Volver',
  actions,
  className = '',
}) {
  return (
    <header className={`app-page-header ${className}`.trim()}>
      <div className="app-page-header__main">
        {backTo ? (
          <Link
            to={backTo}
            className="app-page-header__back"
            title={backTitle}
            aria-label={backTitle}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H6" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
          </Link>
        ) : null}
        <div className="app-page-header__titles">
          <h1 className="app-page-header__title">{title}</h1>
          {subtitle ? <p className="app-page-header__subtitle">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="app-page-header__actions">{actions}</div> : null}
    </header>
  );
}
