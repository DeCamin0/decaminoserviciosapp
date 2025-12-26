import { useMemo } from 'react';
import QuickAccessOrb from '../components/QuickAccessOrb';
import { demoQuickAccessItems } from '../components/quick-access/data';

const DemoOrbPage = () => {
  const items = useMemo(() => demoQuickAccessItems, []);

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.35),transparent_55%),radial-gradient(circle_at_bottom,rgba(236,72,153,0.2),transparent_60%)]" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center gap-12 px-4 py-16">
        <header className="space-y-4 text-center">
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/70">
            Experimento UI
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Quick Access Orb
          </h1>
          <p className="mx-auto max-w-xl text-base text-slate-300">
            Componente reutilizable inspirado en interfaces sci-fi para destacar
            accesos directos principales, con animaciones fluidas y adaptativas.
          </p>
        </header>

        <QuickAccessOrb
          items={items}
          ringSize={560}
          innerSize={260}
          onSelect={(id) => {
            console.info('[DemoOrbPage] Selección:', id);
          }}
        />
      </div>
    </div>
  );
};

export default DemoOrbPage;


