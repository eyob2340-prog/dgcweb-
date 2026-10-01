import React, { useMemo, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  Sparkles,
  Shield,
  MessageSquare,
  FileText,
  Globe,
  Building2,
  Lock,
  Vote,
  Compass,
  Star,
  Zap,
} from 'lucide-react';

interface AnimatedBackgroundProps {
  isDarkMode?: boolean;
}

interface FloatingSymbolItem {
  id: number;
  Icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  type: 'icon' | 'dot' | 'ring' | 'plus' | 'diamond' | 'star' | 'beam';
  initialX: number;
  initialY: number;
  deltaX: number;
  deltaY: number;
  duration: number;
  delay: number;
  size: number;
  rotate: number;
  colorType: 'blue' | 'yellow' | 'cyan' | 'purple' | 'amber';
  opacity: number;
}

const ICON_LIST = [
  Sparkles,
  Shield,
  MessageSquare,
  FileText,
  Globe,
  Building2,
  Lock,
  Vote,
  Compass,
  Star,
  Zap,
];

// Rich, GPU-accelerated particle set
const ELEMENT_COUNT = 18;

export const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({ isDarkMode = true }) => {
  const prefersReducedMotion = useReducedMotion();
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });

  // Subtle interactive light response
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (window.innerWidth < 768) return; // Skip on mobile for speed
      const x = Math.round((e.clientX / window.innerWidth) * 100);
      const y = Math.round((e.clientY / window.innerHeight) * 100);
      setMousePos({ x, y });
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const floatingElements = useMemo<FloatingSymbolItem[]>(() => {
    const items: FloatingSymbolItem[] = [];
    const colorTypes: ('blue' | 'yellow' | 'cyan' | 'purple' | 'amber')[] = [
      'blue',
      'yellow',
      'cyan',
      'amber',
      'purple',
      'blue',
    ];
    const types: ('icon' | 'dot' | 'ring' | 'plus' | 'diamond' | 'star' | 'beam')[] = [
      'icon',
      'dot',
      'ring',
      'star',
      'plus',
      'icon',
      'diamond',
      'dot',
      'beam',
    ];

    for (let i = 0; i < ELEMENT_COUNT; i++) {
      const type = types[i % types.length];
      const Icon = type === 'icon' ? ICON_LIST[i % ICON_LIST.length] : undefined;
      const colorType = colorTypes[i % colorTypes.length];

      const initialX = (i * 15.3 + (i % 7) * 8) % 92 + 4;
      const initialY = (i * 18.7 + (i % 5) * 11) % 90 + 5;
      const deltaX = (i % 2 === 0 ? 1 : -1) * (12 + (i % 4) * 8);
      const deltaY = (i % 3 === 0 ? -1 : 1) * (14 + (i % 5) * 6);
      const duration = 16 + (i % 6) * 4;
      const delay = (i % 5) * 1.1;
      const size = type === 'icon' ? 15 + (i % 3) * 5 : type === 'beam' ? 40 + (i % 3) * 20 : 7 + (i % 3) * 4;
      const rotate = i % 2 === 0 ? 360 : -360;
      const opacity = 0.14 + (i % 4) * 0.05;

      items.push({
        id: i,
        Icon,
        type,
        initialX,
        initialY,
        deltaX,
        deltaY,
        duration,
        delay,
        size,
        rotate,
        colorType,
        opacity,
      });
    }
    return items;
  }, []);

  const getColorClass = (colorType: 'blue' | 'yellow' | 'cyan' | 'purple' | 'amber', isDark: boolean) => {
    switch (colorType) {
      case 'blue':
        return isDark ? 'text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.6)]' : 'text-blue-600 drop-shadow-[0_0_6px_rgba(37,99,235,0.3)]';
      case 'yellow':
        return isDark ? 'text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]' : 'text-amber-500 drop-shadow-[0_0_6px_rgba(245,158,11,0.35)]';
      case 'cyan':
        return isDark ? 'text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.6)]' : 'text-cyan-600';
      case 'purple':
        return isDark ? 'text-purple-400 drop-shadow-[0_0_10px_rgba(168,85,247,0.6)]' : 'text-purple-600';
      case 'amber':
        return isDark ? 'text-orange-400 drop-shadow-[0_0_10px_rgba(251,146,60,0.6)]' : 'text-orange-500';
      default:
        return 'text-blue-400';
    }
  };

  const getShapeColorStyle = (colorType: 'blue' | 'yellow' | 'cyan' | 'purple' | 'amber', isDark: boolean) => {
    switch (colorType) {
      case 'blue':
        return isDark ? 'bg-blue-500 shadow-[0_0_14px_rgba(59,130,246,0.7)]' : 'bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.3)]';
      case 'yellow':
        return isDark ? 'bg-amber-400 shadow-[0_0_14px_rgba(251,191,36,0.7)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.35)]';
      case 'cyan':
        return isDark ? 'bg-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.7)]' : 'bg-cyan-500';
      case 'purple':
        return isDark ? 'bg-purple-500 shadow-[0_0_14px_rgba(168,85,247,0.7)]' : 'bg-purple-600';
      case 'amber':
        return isDark ? 'bg-orange-400 shadow-[0_0_14px_rgba(251,146,60,0.7)]' : 'bg-orange-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none transition-colors duration-500"
    >
      {/* Dynamic Background Base Canvas with Deep Gradient */}
      <div
        className={`absolute inset-0 transition-colors duration-500 ${
          isDarkMode
            ? 'bg-slate-950 [background-image:radial-gradient(ellipse_90%_90%_at_50%_-20%,rgba(37,99,235,0.22),rgba(2,6,23,0.98))]'
            : 'bg-slate-50 [background-image:radial-gradient(ellipse_90%_90%_at_50%_-20%,rgba(59,130,246,0.15),rgba(255,255,255,0.96))]'
        }`}
      />

      {/* Interactive Cursor Spotlight Glow */}
      <div
        className="absolute w-[36rem] h-[36rem] rounded-full blur-[130px] opacity-25 pointer-events-none transition-all duration-700 ease-out will-change-transform"
        style={{
          left: `${mousePos.x}%`,
          top: `${mousePos.y}%`,
          transform: 'translate(-50%, -50%)',
          background: isDarkMode
            ? 'radial-gradient(circle, rgba(59,130,246,0.4) 0%, rgba(245,158,11,0.2) 60%, transparent 80%)'
            : 'radial-gradient(circle, rgba(37,99,235,0.25) 0%, rgba(217,119,6,0.15) 60%, transparent 80%)',
        }}
      />

      {/* Sleek Civic Dot Matrix Grid */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: isDarkMode
            ? `radial-gradient(#60a5fa 1.2px, transparent 1.2px), radial-gradient(#fbbf24 1.2px, transparent 1.2px)`
            : `radial-gradient(#1d4ed8 1.2px, transparent 1.2px), radial-gradient(#d97706 1.2px, transparent 1.2px)`,
          backgroundSize: '40px 40px',
          backgroundPosition: '0 0, 20px 20px',
        }}
      />

      {/* Moving Ambient Glowing Lights / Aurora Beams */}
      <motion.div
        animate={
          prefersReducedMotion
            ? {}
            : {
                x: [0, 80, -60, 0],
                y: [0, -70, 60, 0],
                scale: [1, 1.25, 0.9, 1],
                opacity: isDarkMode ? [0.22, 0.32, 0.18, 0.22] : [0.16, 0.24, 0.14, 0.16],
              }
        }
        transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
        className={`absolute -top-32 -left-32 w-[34rem] h-[34rem] rounded-full blur-[120px] will-change-transform ${
          isDarkMode ? 'bg-blue-600' : 'bg-blue-400'
        }`}
      />

      <motion.div
        animate={
          prefersReducedMotion
            ? {}
            : {
                x: [0, -80, 70, 0],
                y: [0, 90, -50, 0],
                scale: [1, 1.2, 0.85, 1],
                opacity: isDarkMode ? [0.18, 0.28, 0.14, 0.18] : [0.15, 0.22, 0.12, 0.15],
              }
        }
        transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        className={`absolute top-1/4 -right-32 w-[32rem] h-[32rem] rounded-full blur-[130px] will-change-transform ${
          isDarkMode ? 'bg-amber-500' : 'bg-amber-400'
        }`}
      />

      <motion.div
        animate={
          prefersReducedMotion
            ? {}
            : {
                x: [0, 50, -40, 0],
                y: [0, -50, 40, 0],
                scale: [0.9, 1.15, 0.95, 0.9],
                opacity: isDarkMode ? [0.12, 0.22, 0.1, 0.12] : [0.1, 0.18, 0.08, 0.1],
              }
        }
        transition={{ duration: 32, repeat: Infinity, ease: 'easeInOut', delay: 4 }}
        className={`absolute bottom-10 left-1/3 w-[28rem] h-[28rem] rounded-full blur-[110px] will-change-transform ${
          isDarkMode ? 'bg-indigo-600' : 'bg-indigo-400'
        }`}
      />

      {/* Floating Animated Civic & Tech Symbols with Glowing Shadows */}
      {!prefersReducedMotion &&
        floatingElements.map((el) => {
          const IconComponent = el.Icon;
          const colorClass = getColorClass(el.colorType, isDarkMode);
          const shapeStyle = getShapeColorStyle(el.colorType, isDarkMode);

          return (
            <motion.div
              key={el.id}
              initial={{
                x: `${el.initialX}vw`,
                y: `${el.initialY}vh`,
                opacity: el.opacity,
              }}
              animate={{
                x: [
                  `${el.initialX}vw`,
                  `${el.initialX + el.deltaX * 0.14}vw`,
                  `${el.initialX - el.deltaX * 0.1}vw`,
                  `${el.initialX}vw`,
                ],
                y: [
                  `${el.initialY}vh`,
                  `${el.initialY + el.deltaY * 0.14}vh`,
                  `${el.initialY - el.deltaY * 0.12}vh`,
                  `${el.initialY}vh`,
                ],
                rotate: [0, el.rotate * 0.5, el.rotate],
                opacity: [
                  el.opacity,
                  el.opacity * 1.6,
                  el.opacity * 0.8,
                  el.opacity,
                ],
              }}
              transition={{
                duration: el.duration,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: el.delay,
              }}
              className="absolute will-change-transform pointer-events-none"
              style={{ left: 0, top: 0 }}
            >
              {el.type === 'icon' && IconComponent && (
                <div className={colorClass}>
                  <IconComponent
                    style={{ width: `${el.size}px`, height: `${el.size}px` }}
                  />
                </div>
              )}

              {el.type === 'dot' && (
                <div
                  className={`rounded-full ${shapeStyle}`}
                  style={{ width: `${el.size}px`, height: `${el.size}px` }}
                />
              )}

              {el.type === 'ring' && (
                <div
                  className={`rounded-full border-2 ${
                    el.colorType === 'yellow' || el.colorType === 'amber'
                      ? isDarkMode
                        ? 'border-amber-400/70 shadow-[0_0_10px_rgba(251,191,36,0.4)]'
                        : 'border-amber-500/60'
                      : isDarkMode
                      ? 'border-blue-400/70 shadow-[0_0_10px_rgba(59,130,246,0.4)]'
                      : 'border-blue-600/60'
                  }`}
                  style={{ width: `${el.size + 4}px`, height: `${el.size + 4}px` }}
                />
              )}

              {el.type === 'plus' && (
                <div
                  className={`font-black select-none ${colorClass}`}
                  style={{ fontSize: `${el.size + 3}px`, lineHeight: 1 }}
                >
                  +
                </div>
              )}

              {el.type === 'diamond' && (
                <div
                  className={`rotate-45 ${shapeStyle}`}
                  style={{ width: `${el.size}px`, height: `${el.size}px` }}
                />
              )}

              {el.type === 'star' && (
                <div
                  className={`font-black select-none ${colorClass}`}
                  style={{ fontSize: `${el.size + 4}px`, lineHeight: 1 }}
                >
                  ✦
                </div>
              )}

              {el.type === 'beam' && (
                <div
                  className="h-[1.5px] rounded-full opacity-40 will-change-transform"
                  style={{
                    width: `${el.size}px`,
                    background: isDarkMode
                      ? 'linear-gradient(90deg, transparent, #60a5fa, transparent)'
                      : 'linear-gradient(90deg, transparent, #3b82f6, transparent)',
                  }}
                />
              )}
            </motion.div>
          );
        })}
    </div>
  );
};
