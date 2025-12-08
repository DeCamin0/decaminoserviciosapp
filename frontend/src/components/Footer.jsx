// React import removed - not used

// Folosește logo-ul din public (accesibil prin ngrok)
const getLogoUrl = () => {
  return '/DeCamino-04.svg';
};

const Footer = () => {
  return (
    <footer className="bg-gradient-to-br from-red-600 via-red-500 to-red-600 dark:from-gray-800 dark:via-gray-900 dark:to-gray-800 backdrop-blur-sm py-6 mt-8 relative z-20 shadow-lg dark:shadow-xl dark:border-t dark:border-gray-700 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center space-y-4">
          <p className="text-white dark:text-gray-100 text-sm sm:text-base text-center font-bold">
            Esta aplicación ha sido diseñada y desarrollada por DeCamino
          </p>
          {/* Logo elegant cu fundal circular și efect glow alb-negru - CLICKABLE */}
          <a 
            href="https://decamino.es" 
            target="_blank" 
            rel="noopener noreferrer"
            className="relative group transition-all duration-300 transform hover:scale-110 hover:shadow-xl"
            title="Visita el sitio web de DeCamino"
          >
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white dark:bg-gray-100 rounded-full flex items-center justify-center shadow-lg border-2 sm:border-3 border-gray-800 dark:border-gray-300 group-hover:border-red-500 dark:group-hover:border-red-400 transition-colors duration-300">
              <img 
                src={getLogoUrl()} 
                alt="DeCamino Logo" 
                className="h-8 w-8 sm:h-10 sm:w-10 object-contain group-hover:scale-110 transition-transform duration-300"
                onError={(e) => {
                  // Fallback text dacă logo-ul nu se încarcă
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              />
              {/* Fallback text dacă logo-ul nu se încarcă */}
              <div className="hidden text-gray-800 dark:text-gray-900 font-bold text-sm sm:text-base group-hover:text-red-600 dark:group-hover:text-red-500 transition-colors duration-300">DC</div>
            </div>
            {/* Efect de glow negru cu hover effect */}
            <div className="absolute inset-0 w-12 h-12 sm:w-16 sm:h-16 bg-gray-600 dark:bg-gray-500 rounded-full opacity-20 dark:opacity-30 blur-md animate-pulse group-hover:bg-red-400 dark:group-hover:bg-red-500 group-hover:opacity-30 dark:group-hover:opacity-40 transition-all duration-300"></div>
          </a>
          <div className="flex items-center justify-center gap-2 text-white/80 dark:text-gray-200 text-xs sm:text-sm">
            <span>© 2025</span>
            {/* Logo mic elegant pentru copyright - design alb și negru - CLICKABLE */}
            <a 
              href="https://decamino.es" 
              target="_blank" 
              rel="noopener noreferrer"
              className="relative group transition-all duration-300 transform hover:scale-110"
              title="Visita el sitio web de DeCamino"
            >
              <div className="w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 bg-white dark:bg-gray-100 rounded-full flex items-center justify-center shadow-md border border-gray-800 dark:border-gray-300 group-hover:border-red-500 dark:group-hover:border-red-400 transition-colors duration-300">
                <img 
                  src={getLogoUrl()} 
                  alt="DeCamino" 
                  className="h-3 w-3 sm:h-4 sm:w-4 lg:h-5 lg:w-5 object-contain group-hover:scale-110 transition-transform duration-300"
                  onError={(e) => {
                    // Fallback la text dacă logo-ul nu se încarcă
                    e.target.outerHTML = '<span class="text-gray-800 dark:text-gray-900 font-bold text-xs group-hover:text-red-600 dark:group-hover:text-red-500 transition-colors duration-300">DC</span>';
                  }}
                />
              </div>
              {/* Efect de glow negru cu hover effect */}
              <div className="absolute inset-0 w-5 h-5 sm:w-6 sm:h-6 lg:w-7 lg:h-7 bg-gray-600 dark:bg-gray-500 rounded-full opacity-15 dark:opacity-25 blur-sm animate-pulse group-hover:bg-red-400 dark:group-hover:bg-red-500 group-hover:opacity-25 dark:group-hover:opacity-35 transition-all duration-300"></div>
            </a>
            <span className="text-white/70 dark:text-gray-300">- Todos los derechos reservados</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 