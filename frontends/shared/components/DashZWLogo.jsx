import React from 'react';

/**
 * DashZW brand mark — scooter/delivery icon used on splash and in-app headers.
 */
export default function DashZWLogo({ className = 'w-12 h-12' }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <ellipse cx="30" cy="34" rx="7" ry="7" stroke="currentColor" strokeWidth="2.5" fill="none" />
      <ellipse cx="12" cy="34" rx="5" ry="5" stroke="currentColor" strokeWidth="2.5" fill="none" />
      <path d="M17 34 L23 34 L28 24 L36 24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <path
        d="M28 24 L30 18 L20 18 L17 24"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="30" cy="13" r="4" fill="currentColor" opacity="0.9" />
      <path d="M28 17 C26 20 25 23 26 25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 20 L12 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <path d="M2 25 L10 25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.4" />
      <path d="M5 15 L11 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
    </svg>
  );
}
