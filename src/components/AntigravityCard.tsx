import React, { useRef, useState, useCallback, useEffect } from 'react';

export interface AntigravityCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  maxTilt?: number;
  glare?: boolean;
  glowColor?: string;
  elevation?: 'low' | 'medium' | 'high';
  className?: string;
}

export const AntigravityCard: React.FC<AntigravityCardProps> = ({
  children,
  maxTilt = 6,
  glare = true,
  glowColor,
  elevation = 'medium',
  className = '',
  style,
  ...rest
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transformStyle, setTransformStyle] = useState<React.CSSProperties>({});
  const [glareStyle, setGlareStyle] = useState<React.CSSProperties>({ opacity: 0 });
  const [reducedMotion, setReducedMotion] = useState(false);
  const rafId = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReducedMotion(mediaQuery.matches);
      const listener = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', listener);
        return () => mediaQuery.removeEventListener('change', listener);
      }
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion || !cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const normX = (x - centerX) / centerX; // -1 to 1
    const normY = (y - centerY) / centerY; // -1 to 1

    const rotX = -normY * maxTilt;
    const rotY = normX * maxTilt;

    if (rafId.current) cancelAnimationFrame(rafId.current);

    rafId.current = requestAnimationFrame(() => {
      setTransformStyle({
        transform: `perspective(1000px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) translateY(-4px) translateZ(8px)`,
        transition: 'transform 0.1s ease-out',
      });

      if (glare) {
        const percentX = ((x / rect.width) * 100).toFixed(1);
        const percentY = ((y / rect.height) * 100).toFixed(1);
        setGlareStyle({
          opacity: 1,
          background: `radial-gradient(circle at ${percentX}% ${percentY}%, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.02) 40%, transparent 70%)`,
        });
      }
    });
  }, [maxTilt, glare, reducedMotion]);

  const handleMouseLeave = useCallback(() => {
    if (rafId.current) cancelAnimationFrame(rafId.current);
    setTransformStyle({
      transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px) translateZ(0px)',
      transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    });
    setGlareStyle({
      opacity: 0,
      transition: 'opacity 0.4s ease-out',
    });
  }, []);

  // Soft multi-tiered floating shadow with true glass refraction highlight
  const shadowTier = {
    low: '0 8px 20px -6px rgba(0, 0, 0, 0.45), inset 0 1px 0 0 rgba(255, 255, 255, 0.07)',
    medium: '0 16px 36px -10px rgba(0, 0, 0, 0.55), inset 0 1px 0 0 rgba(255, 255, 255, 0.09)',
    high: '0 24px 48px -12px rgba(0, 0, 0, 0.65), inset 0 1px 0 0 rgba(255, 255, 255, 0.12)',
  }[elevation];

  const ambientGlow = glowColor
    ? { boxShadow: `${shadowTier}, 0 0 30px -8px ${glowColor}` }
    : { boxShadow: shadowTier };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`antigravity-card ${className}`}
      style={{
        position: 'relative',
        transformStyle: 'preserve-3d',
        willChange: 'transform',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        background: 'rgba(15, 23, 42, 0.72)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '16px',
        ...ambientGlow,
        ...transformStyle,
        ...style,
      }}
      {...rest}
    >
      {/* Dynamic cursor sheen / glare reflection */}
      {glare && (
        <div
          className="antigravity-glare"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'inherit',
            pointerEvents: 'none',
            zIndex: 1,
            mixBlendMode: 'overlay',
            ...glareStyle,
          }}
          aria-hidden="true"
        />
      )}
      
      {/* Specular border reflection highlight */}
      <div
        className="antigravity-rim-highlight"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'inherit',
          pointerEvents: 'none',
          padding: '1px',
          background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.02) 50%, rgba(99, 102, 241, 0.15) 100%)',
          WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          zIndex: 2,
        }}
        aria-hidden="true"
      />

      {/* Content wrapper with Z-depth positioning */}
      <div style={{ position: 'relative', zIndex: 3, transformStyle: 'preserve-3d', height: '100%', width: '100%' }}>
        {children}
      </div>
    </div>
  );
};
