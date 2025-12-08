import { useState, useEffect } from 'react';
import { ThemeContext } from './ThemeContextBase';

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(() => {
    // Verifică preferința salvată în localStorage
    const saved = localStorage.getItem('decamino-theme');
    if (saved) {
      return saved === 'dark';
    }
    
    // Dacă nu există preferință salvată, verifică preferința sistemului
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    // Salvează preferința în localStorage
    localStorage.setItem('decamino-theme', isDark ? 'dark' : 'light');
    
    // Aplică tema la document
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const toggleTheme = () => {
    setIsDark(prev => !prev);
  };

  const setTheme = (theme) => {
    setIsDark(theme === 'dark');
  };

  return (
    <ThemeContext.Provider value={{ 
      isDark, 
      toggleTheme, 
      setTheme,
      theme: isDark ? 'dark' : 'light'
    }}>
      {children}
    </ThemeContext.Provider>
  );
};
