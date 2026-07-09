import React, { useEffect, useRef, useState } from 'react';
import DashZWLogo from './DashZWLogo.jsx';

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
          <div className="w-20 h-20 rounded-3xl bg-white/15 backdrop-blur flex items-center justify-center shadow-2xl border border-white/20 text-white">
            <DashZWLogo className="w-12 h-12" />
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
