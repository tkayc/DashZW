import React from 'react';
import { Link } from 'react-router-dom';

export default function HeroBanner() {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-primary to-primary/80 rounded-2xl mx-4 mt-4 p-6">
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-6 -translate-x-6" />
      <div className="relative z-10">
        <h1 className="text-primary-foreground text-2xl font-bold leading-tight">
          What do you need<br />delivered?
        </h1>
        <p className="text-primary-foreground/70 text-sm mt-2">
          Food, groceries, pharmacy & more — from local merchants
        </p>
        <div className="flex gap-2 mt-4">
          <Link
            to="/explore"
            className="text-xs font-semibold bg-white/20 text-primary-foreground px-3 py-1.5 rounded-xl hover:bg-white/30"
          >
            Explore
          </Link>
          <Link
            to="/recommendations"
            className="text-xs font-semibold bg-white text-primary px-3 py-1.5 rounded-xl hover:bg-white/90"
          >
            For you
          </Link>
        </div>
      </div>
    </div>
  );
}
