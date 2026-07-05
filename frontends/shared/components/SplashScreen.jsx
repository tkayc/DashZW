import React, { useEffect, useRef, useState } from 'react';

/**
 * Branded splash — shown once per session when entering an app.
 * Uses a ref for onDone so parent re-renders do not reset the timer.
 */
export default function SplashScreen({
  onDone,
  tagline = 'Food delivery, made local',
  footer = 'Delivering happiness',
}) {
  const [phase, setPhase] = useState(0);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 400);
    const t2 = setTimeout(() => setPhase(2), 900);
    const t3 = setTimeout(() => setPhase(3), 2400);
    const t4 = setTimeout(() => onDoneRef.current?.(), 3000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-primary transition-opacity duration-500 ${
        phase === 3 ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`transition-all duration-500 ${
            phase === 0 ? 'opacity-0 scale-50' : 'opacity-100 scale-100'
          }`}
        >
          <div className="w-20 h-20 rounded-3xl bg-white/15 backdrop-blur flex items-center justify-center shadow-2xl border border-white/20">
            <svg viewBox="0 0 48 48" className="w-12 h-12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <ellipse cx="30" cy="34" rx="7" ry="7" stroke="white" strokeWidth="2.5" fill="none" />
              <ellipse cx="12" cy="34" rx="5" ry="5" stroke="white" strokeWidth="2.5" fill="none" />
              <path d="M17 34 L23 34 L28 24 L36 24" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <path
                d="M28 24 L30 18 L20 18 L17 24"
                stroke="white"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="30" cy="13" r="4" fill="white" opacity="0.9" />
              <path d="M28 17 C26 20 25 23 26 25" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <path d="M4 20 L12 20" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
              <path d="M2 25 L10 25" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
              <path d="M5 15 L11 15" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
            </svg>
          </div>
        </div>
        <div
          className={`overflow-hidden transition-all duration-500 ${
            phase >= 1 ? 'max-w-[240px] opacity-100' : 'max-w-0 opacity-0'
          }`}
        >
          <div className={`transition-transform duration-500 ${phase >= 1 ? 'translate-x-0' : 'translate-x-8'}`}>
            <p className="text-white font-black text-4xl tracking-tight leading-none whitespace-nowrap">DashZW</p>
            <p className="text-white/70 text-sm font-medium tracking-wider mt-1 whitespace-nowrap">{tagline}</p>
          </div>
        </div>
      </div>
      <div
        className={`absolute bottom-16 transition-all duration-700 ${
          phase >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <p className="text-white/50 text-xs tracking-widest uppercase">{footer}</p>
      </div>
    </div>
  );
}
