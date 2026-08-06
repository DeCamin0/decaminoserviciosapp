import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useSpring,
} from 'framer-motion';
import { useNavigate } from 'react-router';
import type { ActionItem, QuickAccessOrbProps } from './quick-access/types';
import './QuickAccessOrb.css';

const DEFAULT_RING_SIZE = 560;
const DEFAULT_INNER_SIZE = 260;
const DEFAULT_AUTO_SPIN_SPEED = 0;

type PositionedItem = {
  item: ActionItem;
  angle: number;
  x: number;
  y: number;
};

const polarToCartesian = (radius: number, angleDeg: number) => {
  const angleRad = (angleDeg * Math.PI) / 180;
  return {
    x: radius * Math.cos(angleRad),
    y: radius * Math.sin(angleRad),
  };
};

const cn = (...values: Array<string | false | null | undefined>) =>
  values.filter(Boolean).join(' ');

const springConfig = {
  stiffness: 80,
  damping: 18,
  mass: 0.8,
};

/** Desktop orbit only ≥1024px — matchMedia is reliable with DevTools device mode. */
const useIsDesktopOrbit = () => {
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(min-width: 1024px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);

  return isDesktop;
};

const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.('change', update);
    return () => mq.removeEventListener?.('change', update);
  }, []);
  return reduced;
};

const QuickAccessOrb = ({
  items,
  className,
  autoSpinSpeed = DEFAULT_AUTO_SPIN_SPEED,
  ringSize = DEFAULT_RING_SIZE,
  innerSize = DEFAULT_INNER_SIZE,
  onSelect,
}: QuickAccessOrbProps) => {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const isOrbit = useIsDesktopOrbit();
  const prefersReducedMotion = usePrefersReducedMotion();

  const isHolidaySeason = useMemo(() => {
    const now = new Date();
    return now.getMonth() === 11 || (now.getMonth() === 0 && now.getDate() <= 6);
  }, []);

  const rotation = useMotionValue(0);

  useAnimationFrame((_, delta) => {
    if (isPaused || prefersReducedMotion) return;
    if (!items.length || autoSpinSpeed <= 0) return;
    if (isOrbit !== true) return;
    const deltaDegrees = (delta / 1000) * (360 / autoSpinSpeed);
    const nextValue = (rotation.get() + deltaDegrees) % 360;
    rotation.set(nextValue);
  });

  const rawParallaxX = useMotionValue(0);
  const rawParallaxY = useMotionValue(0);
  const parallaxX = useSpring(rawParallaxX, springConfig);
  const parallaxY = useSpring(rawParallaxY, springConfig);

  const handlePause = useCallback((value: boolean) => {
    setIsPaused(value);
  }, []);

  const handleMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!isOrbit || prefersReducedMotion) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const relativeX = (event.clientX - rect.left) / rect.width;
      const relativeY = (event.clientY - rect.top) / rect.height;
      const offsetMultiplier = 16;
      rawParallaxX.set((relativeX - 0.5) * offsetMultiplier);
      rawParallaxY.set((relativeY - 0.5) * offsetMultiplier);
    },
    [isOrbit, prefersReducedMotion, rawParallaxX, rawParallaxY],
  );

  const handleMouseLeave = useCallback(() => {
    rawParallaxX.set(0);
    rawParallaxY.set(0);
  }, [rawParallaxX, rawParallaxY]);

  const positionedItems = useMemo<PositionedItem[]>(() => {
    if (!items.length) return [];
    const radius = ringSize / 2;
    const step = 360 / items.length;
    return items.map((item, index) => {
      const angle = -90 + index * step;
      const { x, y } = polarToCartesian(radius, angle);
      return {
        item,
        angle,
        x: radius + x,
        y: radius + y,
      };
    });
  }, [items, ringSize]);

  const handleActivate = useCallback(
    (item: ActionItem, event?: React.MouseEvent) => {
      if (item.disabled) return;

      if (event) {
        if (event.button === 1 || (event.button === 0 && (event.ctrlKey || event.metaKey))) {
          event.preventDefault();
          if (item.href) {
            window.open(item.href, '_blank');
          }
          return;
        }
      }

      onSelect?.(item.id);
      if (item.href) {
        navigate(item.href);
      }
    },
    [navigate, onSelect],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!items.length) return;
      const currentIndex = items.findIndex((item) => item.id === focusedId);
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        const nextIndex = (currentIndex + 1 + items.length) % items.length;
        const nextId = items[nextIndex]?.id;
        if (nextId) {
          setFocusedId(nextId);
          const nextButton = containerRef.current?.querySelector<HTMLButtonElement>(
            `[data-qa-item="${nextId}"]`,
          );
          nextButton?.focus();
        }
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        const prevIndex = (currentIndex - 1 + items.length * 2) % items.length;
        const prevId = items[prevIndex]?.id;
        if (prevId) {
          setFocusedId(prevId);
          const prevButton = containerRef.current?.querySelector<HTMLButtonElement>(
            `[data-qa-item="${prevId}"]`,
          );
          prevButton?.focus();
        }
      }
    },
    [focusedId, items],
  );

  const tooltipIdFor = (id: string) => `qa-tooltip-${id}`;

  const renderBadge = (count?: number, compact = false) => {
    if (!count) return null;
    return (
      <span
        className={cn(
          compact ? 'qa-grid__badge' : undefined,
          !compact &&
            'absolute -right-2 -top-2 flex min-h-[1.5rem] min-w-[1.5rem] items-center justify-center rounded-full bg-red-500 px-2 text-xs font-bold text-white shadow-sm',
        )}
      >
        {count > 99 ? '99+' : count}
      </span>
    );
  };

  const renderGridItem = (item: ActionItem) => {
    const tooltipId = item.hint ? tooltipIdFor(item.id) : undefined;
    const isActive = hoveredId === item.id || focusedId === item.id;
    return (
      <button
        key={item.id}
        type="button"
        data-qa-item={item.id}
        aria-label={item.label}
        aria-describedby={tooltipId}
        title={item.hint || item.label}
        onClick={(e) => handleActivate(item, e)}
        onMouseDown={(e) => {
          if (e.button === 1 && item.href) {
            e.preventDefault();
            window.open(item.href, '_blank');
          }
        }}
        disabled={item.disabled}
        onMouseEnter={() => setHoveredId(item.id)}
        onMouseLeave={() => setHoveredId(null)}
        onFocus={() => setFocusedId(item.id)}
        onBlur={() => setFocusedId(null)}
        className={cn('qa-grid__item', isActive && !item.disabled && 'is-active')}
      >
        <div className={cn('qa-grid__icon', `bg-gradient-to-br ${item.gradient}`)}>
          {item.icon}
          {renderBadge(item.notificationCount, true)}
        </div>
        <span className="qa-grid__label">{item.label}</span>
        {item.hint ? (
          <span id={tooltipId} className="sr-only">
            {item.hint}
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <div
      ref={containerRef}
      className={cn('qa-layout relative flex flex-col items-center justify-center', className)}
      onMouseEnter={() => handlePause(true)}
      onMouseLeave={() => {
        handlePause(false);
        handleMouseLeave();
      }}
      onFocusCapture={() => handlePause(true)}
      onBlurCapture={() => handlePause(false)}
      onMouseMove={handleMouseMove}
      role="group"
      aria-label="Acceso rápido"
    >
      {isOrbit && (
        <div
          className="relative flex items-center justify-center"
          style={{ width: ringSize, height: ringSize }}
          onKeyDown={handleKeyDown}
        >
          <motion.div
            className="absolute inset-0"
            style={{
              rotate: rotation,
              x: prefersReducedMotion ? 0 : parallaxX,
              y: prefersReducedMotion ? 0 : parallaxY,
            }}
          >
            <svg
              viewBox={`0 0 ${ringSize} ${ringSize}`}
              className="pointer-events-none absolute inset-0 h-full w-full"
              aria-hidden
            >
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={ringSize / 2 - 12}
                stroke="color-mix(in srgb, var(--primary-color) 28%, transparent)"
                strokeWidth={1.25}
                strokeDasharray="5 10"
                fill="none"
              />
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={ringSize / 2 - 42}
                stroke="rgba(148,163,184,0.35)"
                strokeWidth={1}
                strokeDasharray="2 12"
                fill="none"
              />
            </svg>

            {positionedItems.map(({ item, x, y }) => {
              const isActive = hoveredId === item.id || focusedId === item.id;
              const tooltipId = item.hint ? tooltipIdFor(item.id) : undefined;
              return (
                <div
                  key={item.id}
                  className="absolute"
                  style={{
                    left: x - 48,
                    top: y - 48,
                    width: 96,
                    height: 96,
                  }}
                >
                  <button
                    type="button"
                    data-qa-item={item.id}
                    aria-label={item.label}
                    aria-describedby={tooltipId}
                    onClick={(e) => handleActivate(item, e)}
                    onMouseDown={(e) => {
                      if (e.button === 1 && item.href) {
                        e.preventDefault();
                        window.open(item.href, '_blank');
                      }
                    }}
                    disabled={item.disabled}
                    className={cn(
                      'group relative h-full w-full overflow-visible rounded-2xl border border-white/15 bg-neutral-900/75 text-left shadow-md transition duration-200',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
                      item.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
                      isActive && !item.disabled && 'border-primary-400/50 shadow-lg',
                    )}
                    onMouseEnter={() => setHoveredId(item.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onFocus={() => setFocusedId(item.id)}
                    onBlur={() => setFocusedId(null)}
                    style={{
                      transform: isActive && !prefersReducedMotion ? 'translateY(-3px) scale(1.03)' : undefined,
                    }}
                  >
                    <div className="relative flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-2xl px-1 text-center">
                      <div
                        className={cn(
                          'relative flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm',
                          `bg-gradient-to-br ${item.gradient}`,
                        )}
                      >
                        {item.icon}
                      </div>
                      <p className="line-clamp-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-100">
                        {item.label}
                      </p>
                      {renderBadge(item.notificationCount)}
                    </div>
                  </button>
                  {item.hint ? (
                    <div
                      id={tooltipId}
                      role="tooltip"
                      className={cn(
                        'pointer-events-none absolute left-1/2 z-20 w-40 -translate-x-1/2 translate-y-2 rounded-lg border border-white/10 bg-slate-900/95 px-3 py-2 text-center text-xs text-slate-200 shadow-lg backdrop-blur transition-opacity duration-150',
                        hoveredId === item.id ? 'opacity-100' : 'opacity-0',
                      )}
                    >
                      {item.hint}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </motion.div>

          <div
            className="relative flex items-center justify-center"
            style={{ width: innerSize, height: innerSize }}
          >
            <div
              className="absolute inset-0 rounded-full border border-primary-400/25 shadow-lg"
              style={{
                background:
                  'radial-gradient(circle at 30% 25%, color-mix(in srgb, var(--primary-color) 35%, transparent), transparent 58%), radial-gradient(circle at 70% 75%, color-mix(in srgb, var(--primary-color-darkest, var(--primary-color)) 28%, transparent), transparent 55%), #0f172a',
              }}
            />
            <div className="relative flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-full px-6 text-center">
              {isHolidaySeason ? (
                <>
                  <span className="text-5xl" aria-hidden>
                    🎄
                  </span>
                  <span className="text-sm font-semibold text-white/90">Felices Fiestas</span>
                </>
              ) : (
                <>
                  <span className="text-sm font-semibold text-white/75">Acceso rápido</span>
                  <span className="text-2xl font-bold tracking-wide text-white">Portal</span>
                  <p className="max-w-[75%] text-center text-xs leading-snug text-slate-200/80">
                    Accede a tus herramientas esenciales y mantente al día.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {!isOrbit && (
        <div className="qa-layout">
          <div className="qa-grid__intro">
            {isHolidaySeason ? (
              <p className="qa-grid__intro-title">🎄 Felices Fiestas</p>
            ) : (
              <>
                <p className="qa-grid__intro-title">Acceso rápido</p>
                <p className="qa-grid__intro-sub">Herramientas clave siempre contigo.</p>
              </>
            )}
          </div>
          <div className="qa-grid" onKeyDown={handleKeyDown}>
            {items.map((item) => renderGridItem(item))}
          </div>
        </div>
      )}
    </div>
  );
};

export { QuickAccessOrb };
export type { ActionItem, QuickAccessOrbProps };
export default QuickAccessOrb;
