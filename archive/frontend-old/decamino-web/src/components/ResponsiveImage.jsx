import OptimizedImage from './OptimizedImage';

/**
 * 📱 RESPONSIVE IMAGE COMPONENT
 * Component pentru imagini responsive cu diferite dimensiuni
 */
const ResponsiveImage = ({ 
  src, 
  alt, 
  className = '', 
  sizes = '(max-width: 768px) 192px, (max-width: 1024px) 384px, 512px',
  ...props 
}) => {
  // Generează srcSet pentru diferite dimensiuni
  const generateSrcSet = (baseSrc, sizes) => {
    const srcSet = sizes.map(size => {
      const webpSrc = baseSrc.replace(/\.(png|jpg|jpeg)$/i, `-${size}.webp`);
      const fallbackSrc = baseSrc.replace(/\.(png|jpg|jpeg)$/i, `-${size}.png`);
      return `${webpSrc} ${size}w, ${fallbackSrc} ${size}w`;
    }).join(', ');
    
    return srcSet;
  };

  // Dimensiuni standard pentru responsive
  const standardSizes = [192, 384, 512, 768, 1024];
  const srcSet = generateSrcSet(src, standardSizes);

  return (
    <picture>
      {/* WebP sources pentru diferite dimensiuni */}
      <source 
        srcSet={srcSet}
        type="image/webp"
        sizes={sizes}
      />
      {/* Fallback pentru browser-uri vechi */}
      <OptimizedImage
        src={src}
        alt={alt}
        className={className}
        {...props}
      />
    </picture>
  );
};

export default ResponsiveImage;
