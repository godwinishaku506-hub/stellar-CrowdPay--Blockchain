import React, { useEffect } from 'react';

export function Toast({ message, type = 'success', onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const colors = {
    success: {
      bg: 'var(--color-success-bg, #d1fae5)',
      color: 'var(--color-success-text, #065f46)',
      border: 'var(--color-success-border, #6ee7b7)',
    },
    error: {
      bg: 'var(--color-error-bg, #fee2e2)',
      color: 'var(--color-error-text, #991b1b)',
      border: 'var(--color-error-border, #fca5a5)',
    },
    info: {
      bg: 'var(--color-info-bg, #dbeafe)',
      color: 'var(--color-info-text, #1e40af)',
      border: 'var(--color-info-border, #93c5fd)',
    },
  };
  const c = colors[type] || colors.info;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        background: c.bg,
        color: c.color,
        border: `1px solid ${c.border}`,
        borderRadius: '8px',
        padding: '0.75rem 1rem',
        fontSize: '0.875rem',
        fontWeight: 600,
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        zIndex: 200,
        maxWidth: '320px',
      }}
    >
      {message}
    </div>
  );
}
