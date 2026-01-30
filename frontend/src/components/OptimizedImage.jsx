import { useState, useRef, useEffect } from 'react';

/**
 * 🖼️ OPTIMIZED IMAGE COMPONENT
 * Component pentru imagini optimizate cu lazy loading și fallback
 */
const OptimizedImage = ({ 
  src, 
  alt, 
  className = '', 
  loading = 'lazy',
  decoding = 'async',
  fallback = true,
  ...props 
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef(null);

  // Intersection Observer pentru lazy loading
  useEffect(() => {
    if (loading === 'lazy' && imgRef.current) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        },
        { threshold: 0.1 }
      );

      observer.observe(imgRef.current);
      return () => observer.disconnect();
    } else {
      // Folosim setTimeout pentru a evita apelarea sincronă a setState
      const timer = setTimeout(() => {
        setIsInView(true);
      }, 0);
      
      return () => clearTimeout(timer);
    }
  }, [loading]);

  // Generează WebP src dacă e posibil
  const getWebPSrc = (originalSrc) => {
    if (originalSrc.endsWith('.png') || originalSrc.endsWith('.jpg') || originalSrc.endsWith('.jpeg')) {
      return originalSrc.replace(/\.(png|jpg|jpeg)$/i, '.webp');
    }
    return originalSrc;
  };

  // Generează fallback src
  const getFallbackSrc = (originalSrc) => {
    if (originalSrc.endsWith('.webp')) {
      return originalSrc.replace('.webp', '.png');
    }
    return originalSrc;
  };

  const handleLoad = () => {
    setImageLoaded(true);
  };

  const handleError = () => {
    setImageError(true);
  };

  // Dacă e lazy loading și nu e în view, nu afișa imaginea
  if (loading === 'lazy' && !isInView) {
    return (
      <div 
        ref={imgRef}
        className={`bg-gray-200 animate-pulse ${className}`}
        style={{ aspectRatio: '1/1' }}
        {...props}
      />
    );
  }

  // Dacă e eroare și avem fallback, încercă fallback
  if (imageError && fallback) {
    return (
      <img
        src={getFallbackSrc(src)}
        alt={alt}
        className={className}
        loading="eager"
        decoding="sync"
        onLoad={handleLoad}
        onError={() => setImageError(false)}
        {...props}
      />
    );
  }

  // Afișează imaginea optimizată
  return (
    <picture>
      {/* WebP source pentru browser-uri moderne */}
      <source 
        srcSet={getWebPSrc(src)} 
        type="image/webp"
        media="(min-width: 1px)"
      />
      {/* Fallback pentru browser-uri vechi */}
      <img
        src={src}
        alt={alt}
        className={`${className} ${!imageLoaded ? 'opacity-0' : 'opacity-100'} transition-opacity duration-300`}
        loading={loading}
        decoding={decoding}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
      />
    </picture>
  );
};

export default OptimizedImage;
