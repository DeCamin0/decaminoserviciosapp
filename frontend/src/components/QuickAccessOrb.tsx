import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import {
  motion,
  useAnimationFrame,
  useMotionValue,
  useSpring,
} from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import type { ActionItem, QuickAccessOrbProps } from './quick-access/types';

const DEFAULT_RING_SIZE = 560;
const DEFAULT_INNER_SIZE = 260;
const DEFAULT_AUTO_SPIN_SPEED = 0;

const MOBILE_RING_SIZE = 340;
const MOBILE_INNER_SIZE = 170;
const MOBILE_ITEM_SIZE = 78;
const MOBILE_ICON_SIZE = 32;

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

const roleRingClasses: Record<ActionItem['role'] | 'default', string> = {
  manager: 'ring-2 ring-sky-400/70',
  user: 'ring-2 ring-emerald-400/70',
  default: 'ring-1 ring-white/10',
};

const springConfig = {
  stiffness: 80,
  damping: 18,
  mass: 0.8,
};

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => setIsMobile(window.innerWidth < 768);
    handler();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return isMobile;
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

  // Check if it's holiday season (December 1 - January 6)
  const isHolidaySeason = useMemo(() => {
    const now = new Date();
    return now.getMonth() === 11 || (now.getMonth() === 0 && now.getDate() <= 6);
  }, []);

  const rotation = useMotionValue(0);

  useAnimationFrame((_, delta) => {
    if (isPaused) return;
    if (!items.length || autoSpinSpeed <= 0) return;
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
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const relativeX = (event.clientX - rect.left) / rect.width;
      const relativeY = (event.clientY - rect.top) / rect.height;
      const offsetMultiplier = 24;
      rawParallaxX.set((relativeX - 0.5) * offsetMultiplier);
      rawParallaxY.set((relativeY - 0.5) * offsetMultiplier);
    },
    [rawParallaxX, rawParallaxY],
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
    (item: ActionItem) => {
      if (item.disabled) return;
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
        const prevIndex =
          (currentIndex - 1 + items.length * 2) % items.length;
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

  const effectiveRoleClass = (role: ActionItem['role']) =>
    role ? roleRingClasses[role] : roleRingClasses.default;

  const isMobile = useIsMobile();
  const currentRingSize = isMobile ? MOBILE_RING_SIZE : ringSize;
  const currentInnerSize = isMobile ? MOBILE_INNER_SIZE : innerSize;

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex w-full flex-col items-center justify-center text-white',
        className,
      )}
      onMouseEnter={() => handlePause(true)}
      onMouseLeave={() => handlePause(false)}
      onFocusCapture={() => handlePause(true)}
      onBlurCapture={() => handlePause(false)}
      onMouseMove={handleMouseMove}
      onMouseOut={handleMouseLeave}
      role="group"
      aria-label="Acceso rápido"
    >
      {/* Desktop orbit */}
      {!isMobile && (
        <div
          className="relative flex items-center justify-center"
          style={{ width: ringSize, height: ringSize }}
          onKeyDown={handleKeyDown}
        >
          <motion.div
            className="absolute inset-0"
            style={{
              rotate: rotation,
              x: parallaxX,
              y: parallaxY,
            }}
            transition={{ type: 'spring', stiffness: 60, damping: 20 }}
          >
            <svg
              viewBox={`0 0 ${ringSize} ${ringSize}`}
              className="pointer-events-none absolute inset-0 h-full w-full"
            >
              <defs>
                <radialGradient id="qa-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(59,130,246,0.6)" />
                  <stop offset="60%" stopColor="rgba(59,130,246,0.15)" />
                  <stop offset="100%" stopColor="transparent" />
                </radialGradient>
                <linearGradient
                  id="qa-arc"
                  x1="0%"
                  x2="100%"
                  y1="0%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="rgba(244,114,182,0.4)" />
                  <stop offset="100%" stopColor="rgba(6,182,212,0.4)" />
                </linearGradient>
              </defs>
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={ringSize / 2 - 12}
                stroke="url(#qa-arc)"
                strokeWidth={1.5}
                strokeDasharray="6 10"
                fill="none"
              />
              <circle
                cx={ringSize / 2}
                cy={ringSize / 2}
                r={ringSize / 2 - 42}
                stroke="rgba(148,163,184,0.45)"
                strokeWidth={1}
                strokeDasharray="2 12"
                fill="none"
              />
              {positionedItems.map((current, index) => {
                const next = positionedItems[(index + 1) % positionedItems.length];
                return (
                  <line
                    key={`connector-${current.item.id}`}
                    x1={current.x}
                    y1={current.y}
                    x2={next.x}
                    y2={next.y}
                    stroke="rgba(148,163,184,0.18)"
                    strokeWidth={1}
                  />
                );
              })}
            </svg>

            {positionedItems.map(({ item, x, y }) => {
              const glowId = `qa-glow-${item.id}`;
              const isActive = hoveredId === item.id || focusedId === item.id;
              const tooltipId = item.hint ? tooltipIdFor(item.id) : undefined;
              return (
                <motion.div
                  key={item.id}
                  className="absolute"
                  style={{
                    left: x - 48,
                    top: y - 48,
                    width: 96,
                    height: 96,
                  }}
                >
                  <motion.button
                    type="button"
                    data-qa-item={item.id}
                    aria-label={item.label}
                    aria-describedby={tooltipId}
                    onClick={() => handleActivate(item)}
                    disabled={item.disabled}
                    className={cn(
                      'group relative h-full w-full overflow-visible rounded-3xl bg-neutral-900/70 p-0 text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300',
                      item.disabled
                        ? 'cursor-not-allowed opacity-50'
                        : 'cursor-pointer',
                      effectiveRoleClass(item.role),
                    )}
                    onMouseEnter={() => setHoveredId(item.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onFocus={() => setFocusedId(item.id)}
                    onBlur={() => setFocusedId(null)}
                  >
                    <div
                      className={cn(
                        'absolute inset-0 rounded-3xl bg-gradient-to-br opacity-70 blur-md transition duration-300',
                        'from-transparent via-transparent to-transparent',
                      )}
                      style={{
                        backgroundImage: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.32), rgba(255,255,255,0) 66%)`,
                      }}
                    />
                    <motion.div
                      className={cn(
                        'relative flex h-full w-full flex-col items-center justify-center gap-2 rounded-3xl border border-white/10 bg-gradient-to-br text-center',
                        'from-neutral-900/90 to-neutral-900/60',
                      )}
                      initial={false}
                      animate={{
                        scale: isActive ? 1.06 : 1,
                        y: isActive ? -4 : 0,
                      }}
                      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                    >
                      <div
                        className={cn(
                          'flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg transition duration-300',
                          'from-neutral-800/80 to-neutral-900/80',
                        )}
                        style={{
                          boxShadow: isActive
                            ? '0 0 30px rgba(56,189,248,0.35)'
                            : '0 10px 30px rgba(15,23,42,0.55)',
                        }}
                      >
                        <div
                          className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br text-white transition duration-300',
                            `bg-gradient-to-br ${item.gradient}`,
                          )}
                        >
                          {item.icon}
                        </div>
                      </div>
                      <div className="px-2 text-center">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-100">
                          {item.label}
                        </p>
                      </div>
                      {item.notificationCount ? (
                        <span className="absolute -top-2 -right-2 flex min-h-[1.5rem] min-w-[1.5rem] items-center justify-center rounded-full bg-red-500 px-2 text-xs font-bold text-white shadow-lg">
                          {item.notificationCount > 99
                            ? '99+'
                            : item.notificationCount}
                        </span>
                      ) : null}
                      <div
                        className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 transition duration-300 group-hover:opacity-100"
                        style={{
                          background: 'radial-gradient(circle, rgba(56,189,248,0.15) 0%, rgba(56,189,248,0) 70%)',
                        }}
                      />
                    </motion.div>
                  </motion.button>
                  {item.hint ? (
                    <motion.div
                      id={tooltipId}
                      role="tooltip"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{
                        opacity: hoveredId === item.id ? 1 : 0,
                        y: hoveredId === item.id ? 0 : 8,
                      }}
                      transition={{ duration: 0.2 }}
                      className="pointer-events-none absolute left-1/2 z-20 w-40 -translate-x-1/2 translate-y-3 rounded-lg border border-white/10 bg-slate-900/95 px-3 py-2 text-center text-xs text-slate-200 shadow-lg backdrop-blur"
                    >
                      {item.hint}
                    </motion.div>
                  ) : null}
                </motion.div>
              );
            })}
          </motion.div>

          {/* Central orb */}
          <motion.div
            className="relative flex items-center justify-center"
            style={{
              width: innerSize,
              height: innerSize,
            }}
            animate={{ scale: hoveredId ? 1.02 : 1 }}
            transition={{ type: 'spring', stiffness: 120, damping: 18 }}
          >
            <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.45),transparent_65%),radial-gradient(circle_at_70%_80%,rgba(168,85,247,0.45),transparent_55%)] blur-[2px] opacity-100" />
            <motion.div
              className="absolute inset-0 rounded-full bg-gradient-to-br from-slate-900/95 via-slate-900/80 to-slate-900/60 shadow-[0_0_60px_rgba(56,189,248,0.45)]"
              animate={{
                boxShadow: [
                  '0 0 60px rgba(59,130,246,0.35)',
                  '0 0 90px rgba(59,130,246,0.6)',
                  '0 0 60px rgba(59,130,246,0.35)',
                ],
              }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="relative flex h-full w-full flex-col items-center justify-center gap-2 rounded-full border border-cyan-400/20 text-center"
              style={{
                background:
                  'radial-gradient(circle at 30% 20%, rgba(59,130,246,0.45), rgba(59,130,246,0.05) 55%), radial-gradient(circle at 70% 80%, rgba(236,72,153,0.35), rgba(236,72,153,0.05) 55%)',
              }}
              animate={{
                scale: [1, 1.015, 1],
              }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            >
              {isHolidaySeason ? (
                <>
                  <span className="text-6xl mb-2 animate-bounce" style={{ filter: 'drop-shadow(0 0 8px rgba(34,197,94,0.6))' }}>
                    🎄
                  </span>
                  <span className="text-sm font-semibold text-green-200/90">
                    Felices Fiestas
                  </span>
                </>
              ) : (
                <>
                  <span className="text-lg font-semibold text-cyan-200/80">
                    Acceso rápido
                  </span>
                  <span className="text-3xl font-bold tracking-wide text-white drop-shadow-lg">
                    Portal
                  </span>
                  <p className="max-w-[70%] text-center text-xs text-slate-200/80">
                    Accede a tus herramientas esenciales y mantente al día.
                  </p>
                </>
              )}
            </motion.div>
          </motion.div>
        </div>
      )}

      {/* Mobile ring */}
      {isMobile && (
        <div className="flex w-full flex-col items-center justify-center gap-6">
          <div className="relative flex items-center justify-center" style={{ width: currentRingSize, height: currentRingSize }}>
            <motion.div
              className="absolute inset-0"
              style={{ rotate: rotation, x: parallaxX, y: parallaxY }}
            >
              <svg viewBox={`0 0 ${currentRingSize} ${currentRingSize}`} className="pointer-events-none absolute inset-0 h-full w-full">
                <circle
                  cx={currentRingSize / 2}
                  cy={currentRingSize / 2}
                  r={currentRingSize / 2 - 10}
                  stroke="rgba(94,234,212,0.4)"
                  strokeWidth={1}
                  strokeDasharray="6 8"
                  fill="none"
                />
                <circle
                  cx={currentRingSize / 2}
                  cy={currentRingSize / 2}
                  r={currentRingSize / 2 - 36}
                  stroke="rgba(148,163,184,0.35)"
                  strokeWidth={1}
                  strokeDasharray="2 10"
                  fill="none"
                />
              </svg>

              {items.map((item, index) => {
                const step = (2 * Math.PI) / items.length;
                const angle = -Math.PI / 2 + index * step;
                const radius = currentRingSize / 2 - MOBILE_ITEM_SIZE / 2;
                const x = currentRingSize / 2 + radius * Math.cos(angle) - MOBILE_ITEM_SIZE / 2;
                const y = currentRingSize / 2 + radius * Math.sin(angle) - MOBILE_ITEM_SIZE / 2;
                const tooltipId = item.hint ? tooltipIdFor(item.id) : undefined;
                return (
                  <motion.button
                    key={`mobile-${item.id}`}
                    type="button"
                    data-qa-item={item.id}
                    aria-label={item.label}
                    aria-describedby={tooltipId}
                    onClick={() => handleActivate(item)}
                    disabled={item.disabled}
                    className={cn(
                      'group absolute flex h-[78px] w-[78px] flex-col items-center justify-center rounded-2xl border border-white/10 bg-slate-900/80 text-center text-xs shadow-[0_6px_18px_rgba(15,23,42,0.55)] backdrop-blur-md transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300',
                      item.disabled ? 'opacity-50' : 'active:scale-95',
                      effectiveRoleClass(item.role),
                    )}
                    style={{ left: x, top: y }}
                  >
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br text-white',
                        `bg-gradient-to-br ${item.gradient}`,
                      )}
                    >
                      <div className="flex items-center justify-center" style={{ width: MOBILE_ICON_SIZE, height: MOBILE_ICON_SIZE }}>
                        {item.icon}
                      </div>
                    </div>
                    <span className="mt-1 text-[10px] font-semibold text-white">
                      {item.label}
                    </span>
                    {item.notificationCount ? (
                      <span className="absolute -top-1 -right-1 flex min-h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-lg">
                        {item.notificationCount > 99
                          ? '99+'
                          : item.notificationCount}
                      </span>
                    ) : null}
                  </motion.button>
                );
              })}
            </motion.div>

            <motion.div
              className="relative flex items-center justify-center rounded-full border border-cyan-300/20 text-center"
              style={{
                width: currentInnerSize,
                height: currentInnerSize,
                background:
                  'radial-gradient(circle at 30% 20%, rgba(59,130,246,0.45), rgba(59,130,246,0.05) 55%), radial-gradient(circle at 70% 80%, rgba(236,72,153,0.35), rgba(236,72,153,0.05) 55%)',
              }}
            >
              {isHolidaySeason ? (
                <div className="px-4 text-center">
                  <span className="text-5xl mb-1 block animate-bounce" style={{ filter: 'drop-shadow(0 0 8px rgba(34,197,94,0.6))' }}>
                    🎄
                  </span>
                  <p className="text-xs font-semibold text-green-200/90">
                    Felices Fiestas
                  </p>
                </div>
              ) : (
                <div className="px-4 text-center">
                  <p className="text-sm font-semibold text-cyan-100/80">Acceso rápido</p>
                  <p className="text-xl font-bold text-white">Portal</p>
                  <p className="mt-1 text-[11px] text-cyan-100/70">
                    Herramientas clave siempre contigo.
                  </p>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </div>
  );
};

export { QuickAccessOrb };
export type { ActionItem, QuickAccessOrbProps };
export default QuickAccessOrb;


