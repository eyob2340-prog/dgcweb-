import React, { useState, useRef } from 'react';

interface DgcLogoProps {
  onLongPress?: () => void;
  onClick?: () => void;
  className?: string;
}

export const DgcLogo: React.FC<DgcLogoProps> = ({
  onLongPress,
  onClick,
  className = '',
}) => {
  const [pressProgress, setPressProgress] = useState<number>(0);
  const [isPressing, setIsPressing] = useState<boolean>(false);
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startPress = () => {
    setIsPressing(true);
    setPressProgress(0);

    const startTime = Date.now();
    const duration = 8000;

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min((elapsed / duration) * 100, 100);
      setPressProgress(pct);
    }, 50);

    pressTimerRef.current = setTimeout(() => {
      clearPressState();
      if (onLongPress) {
        onLongPress();
      }
    }, duration);
  };

  const cancelPress = (wasTriggeredByClick = false) => {
    const heldLongEnough = pressProgress >= 99;
    clearPressState();
    if (wasTriggeredByClick && !heldLongEnough && onClick) {
      onClick();
    }
  };

  const clearPressState = () => {
    setIsPressing(false);
    setPressProgress(0);
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  };

  return (
    <div
      className={`relative inline-flex items-center select-none cursor-pointer group ${className}`}
      onMouseDown={startPress}
      onMouseUp={() => cancelPress(true)}
      onMouseLeave={() => cancelPress(false)}
      onTouchStart={startPress}
      onTouchEnd={() => cancelPress(true)}
    >
      {/* Long-Press Progress Ring / Glow Overlay */}
      {isPressing && (
        <div className="absolute -inset-2 bg-gradient-to-r from-red-600 via-amber-500 to-blue-600 rounded-2xl opacity-80 blur-sm animate-pulse pointer-events-none" />
      )}

      {/* Progress Bar under logo during press */}
      {isPressing && (
        <div className="absolute -bottom-2 left-0 right-0 h-1.5 bg-slate-800 rounded-full overflow-hidden z-20">
          <div
            className="h-full bg-gradient-to-r from-amber-400 via-red-500 to-red-600 transition-all duration-75 ease-linear"
            style={{ width: `${pressProgress}%` }}
          />
        </div>
      )}

      {/* SVG DGC Logo */}
      <div className="flex items-center space-x-3 bg-white/95 px-3 py-1.5 rounded-xl border border-blue-200/50 shadow-sm group-hover:shadow-md transition-shadow">
        <svg
          viewBox="0 0 450 140"
          className="h-10 sm:h-12 w-auto object-contain"
          aria-label="DGC Logo"
        >
          {/* 'D' - Royal Blue */}
          <path
            d="M 20,20 L 70,20 C 110,20 135,40 135,70 C 135,100 110,120 70,120 L 20,120 Z"
            fill="#0062E6"
          />
          <path
            d="M 45,42 L 70,42 C 90,42 105,52 105,70 C 105,88 90,98 70,98 L 45,98 Z"
            fill="#FFFFFF"
          />
          <path
            d="M 20,60 L 135,60 M 20,66 L 135,66 M 20,72 L 135,72"
            stroke="#FFFFFF"
            strokeWidth="3.5"
          />
          <path d="M 45,42 L 45,98 L 75,98 L 75,75 L 45,75 Z" fill="#0062E6" />

          {/* 'G' - Gold/Amber */}
          <path
            d="M 230,20 C 185,20 160,45 160,70 C 160,95 185,120 230,120 C 265,120 280,100 280,80 L 220,80 L 220,62 L 300,62 L 300,80 C 300,110 270,135 230,135 C 170,135 140,100 140,70 C 140,40 170,5 230,5 C 270,5 295,25 295,25 L 280,40 C 280,40 260,20 230,20 Z"
            fill="#F5A623"
          />
          <path
            d="M 140,60 L 200,60 M 140,66 L 200,66 M 140,72 L 200,72"
            stroke="#FFFFFF"
            strokeWidth="3"
          />

          {/* 'C' - Royal Blue with Center Circle */}
          <path
            d="M 390,20 C 350,20 325,45 325,70 C 325,95 350,120 390,120 C 420,120 435,100 435,100 L 418,85 C 418,85 405,98 390,98 C 370,98 355,85 355,70 C 355,55 370,42 390,42 C 405,42 418,55 418,55 L 435,40 C 435,40 420,20 390,20 Z"
            fill="#0062E6"
          />
          {/* Inner Circle in C */}
          <circle cx="390" cy="70" r="14" fill="#0062E6" />

          {/* Text Below Logo */}
          <text
            x="225"
            y="126"
            textAnchor="middle"
            fill="#0062E6"
            fontSize="15"
            fontWeight="bold"
            fontFamily="sans-serif"
          >
            ድሬዳዋ መንግስት ኮሙዩኒኬሽን
          </text>
          <text
            x="225"
            y="138"
            textAnchor="middle"
            fill="#D97706"
            fontSize="11"
            fontWeight="bold"
            fontFamily="sans-serif"
          >
            Dire Dawa Government Communication
          </text>
        </svg>

        <div className="hidden sm:block text-left border-l border-slate-200 pl-3">
          <h2 className="text-xs font-black text-blue-900 leading-tight">
            ድሬዳዋ ኮሙዩኒኬሽን
          </h2>
          <p className="text-[10px] text-amber-700 font-bold tracking-tight">
            የሕዝብ አስተያየት መሰብሰቢያ
          </p>
        </div>
      </div>
    </div>
  );
};
