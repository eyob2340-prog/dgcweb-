import React from 'react';

interface AnimatedBackgroundProps {
  isDarkMode?: boolean;
}

/**
 * Static, GPU-cheap backdrop: soft colour washes + a faint grid.
 * Pure CSS — no animation loop, no mouse tracking, no re-renders.
 * (The previous version animated 18 icons and re-rendered on every mouse move,
 * which made low-end phones stutter.)
 */
export const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({ isDarkMode = false }) => {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background: isDarkMode
            ? 'radial-gradient(60rem 40rem at 10% -10%, rgba(37,99,235,0.18), transparent 60%),' +
              'radial-gradient(50rem 35rem at 100% 10%, rgba(245,158,11,0.10), transparent 60%),' +
              'radial-gradient(60rem 40rem at 50% 110%, rgba(16,185,129,0.08), transparent 60%)'
            : 'radial-gradient(60rem 40rem at 10% -10%, rgba(59,130,246,0.14), transparent 60%),' +
              'radial-gradient(50rem 35rem at 100% 10%, rgba(245,158,11,0.12), transparent 60%),' +
              'radial-gradient(60rem 40rem at 50% 110%, rgba(16,185,129,0.08), transparent 60%)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: isDarkMode
            ? 'linear-gradient(rgba(148,163,184,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.05) 1px, transparent 1px)'
            : 'linear-gradient(rgba(15,23,42,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.04) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at 50% 0%, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 50% 0%, black 30%, transparent 75%)',
        }}
      />
    </div>
  );
};
