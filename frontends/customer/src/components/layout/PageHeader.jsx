import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/** Consistent back header for secondary customer screens. */
export default function PageHeader({ title, subtitle, onBack }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-start gap-3 mb-5">
      <button
        type="button"
        onClick={onBack || (() => navigate(-1))}
        className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5"
      >
        <ArrowLeft className="w-4 h-4 text-foreground" />
      </button>
      <div className="min-w-0">
        <h1 className="text-xl font-bold text-foreground leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}
