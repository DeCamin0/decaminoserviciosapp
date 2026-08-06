// Logo DeCamino (desarrollador) – branding del proveedor de la aplicación
const getLogoUrl = () => '/DeCamino-04.svg';

const Footer = () => {
  return (
    <footer className="relative z-0 mt-4 border-t border-gray-200/80 bg-transparent py-3 transition-colors duration-300 dark:border-gray-700/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center gap-2.5 sm:gap-3">
          <p className="text-center text-xs font-semibold text-gray-800 dark:text-gray-100 sm:text-sm">
            Esta aplicación ha sido diseñada y desarrollada por DeCamino
          </p>
          <a
            href="https://decamino.es"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative rounded-full outline-none transition-transform duration-200 hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-[var(--primary-color)] focus-visible:ring-offset-2"
            title="Visita el sitio web de DeCamino"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 bg-white shadow-sm transition-colors duration-200 group-hover:border-[var(--primary-color)] dark:border-gray-500 dark:bg-gray-100 sm:h-12 sm:w-12">
              <img
                src={getLogoUrl()}
                alt="DeCamino Logo"
                className="h-6 w-6 object-contain transition-transform duration-200 group-hover:scale-105 sm:h-7 sm:w-7"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              />
              <div className="hidden text-xs font-bold text-gray-800 transition-colors duration-200 group-hover:text-[var(--primary-color)] dark:text-gray-900 sm:text-sm">
                DC
              </div>
            </div>
          </a>
          <div className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-gray-600 dark:text-gray-300 sm:gap-2 sm:text-xs">
            <span>© {new Date().getFullYear()}</span>
            <a
              href="https://decamino.es"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative rounded-full outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-color)] focus-visible:ring-offset-1"
              title="Visita el sitio web de DeCamino"
            >
              <div className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-white shadow-sm transition-colors duration-200 group-hover:border-[var(--primary-color)] dark:border-gray-500 dark:bg-gray-100 sm:h-6 sm:w-6">
                <img
                  src={getLogoUrl()}
                  alt="DeCamino"
                  className="h-3 w-3 object-contain sm:h-3.5 sm:w-3.5"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    if (e.target.nextSibling) e.target.nextSibling.style.display = 'block';
                  }}
                />
                <span className="hidden text-[10px] font-bold text-gray-800 group-hover:text-[var(--primary-color)] dark:text-gray-900">
                  DC
                </span>
              </div>
            </a>
            <span className="text-gray-500 dark:text-gray-400">- Todos los derechos reservados</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
