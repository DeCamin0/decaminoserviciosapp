import { useState, useEffect, useRef } from 'react';

/**
 * 🖼️ LAZY IMAGE HOOK
 * Hook pentru lazy loading imagini cu Intersection Observer
 */
export const useLazyImage = (src, options = {}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef(null);

  const {
    threshold = 0.1,
    rootMargin = '50px',
    loading = 'lazy'
  } = options;

  useEffect(() => {
    if (loading === 'lazy' && imgRef.current) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        },
        { 
          threshold,
          rootMargin 
        }
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
  }, [loading, threshold, rootMargin]);

  const handleLoad = () => {
    setImageLoaded(true);
  };

  const handleError = () => {
    setImageError(true);
  };

  return {
    imgRef,
    imageLoaded,
    imageError,
    isInView,
    handleLoad,
    handleError
  };
};
