import React from 'react';

/**
 * Renders a category image icon or emoji fallback.
 */
export default function CategoryIcon({ category, emoji, size = 28, className = '' }) {
  const src = typeof category === 'string' ? null : category?.iconSrc;
  const fallback = emoji || (typeof category === 'object' ? category?.icon : category) || '📦';

  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={`object-contain ${className}`}
        draggable={false}
      />
    );
  }

  return (
    <span className={className} style={{ fontSize: size * 0.85, lineHeight: 1 }}>
      {fallback}
    </span>
  );
}
