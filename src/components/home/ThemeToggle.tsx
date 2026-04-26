'use client';

import { useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem('theme') as Theme | null;
    const initial = stored || 'dark';
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
  }

  if (!mounted) return null;

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      className="relative w-14 h-7 rounded-full transition-colors duration-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]"
      style={{
        background: theme === 'dark'
          ? 'linear-gradient(135deg, #1e1b4b, #312e81)'
          : 'linear-gradient(135deg, #7dd3fc, #38bdf8)',
      }}
    >
      {/* Track decoration */}
      <span className="absolute inset-0 rounded-full overflow-hidden">
        {/* Stars (dark mode) */}
        {theme === 'dark' && (
          <>
            <span className="absolute top-1.5 left-2 w-0.5 h-0.5 bg-white/60 rounded-full animate-pulse" />
            <span className="absolute top-3 left-4 w-[3px] h-[3px] bg-white/40 rounded-full animate-pulse" style={{ animationDelay: '0.5s' }} />
            <span className="absolute bottom-1.5 left-3 w-0.5 h-0.5 bg-white/50 rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
          </>
        )}
        {/* Clouds (light mode) */}
        {theme === 'light' && (
          <>
            <span className="absolute top-1 right-2 w-3 h-1.5 bg-white/40 rounded-full" />
            <span className="absolute bottom-1.5 right-4 w-2 h-1 bg-white/30 rounded-full" />
          </>
        )}
      </span>

      {/* Knob */}
      <span
        className="absolute top-0.5 w-6 h-6 rounded-full shadow-md flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        style={{
          left: theme === 'dark' ? '2px' : 'calc(100% - 26px)',
          background: theme === 'dark' ? '#fbbf24' : '#ffffff',
          boxShadow: theme === 'dark'
            ? '0 0 12px rgba(251,191,36,0.5), inset 0 0 4px rgba(251,191,36,0.3)'
            : '0 1px 4px rgba(0,0,0,0.15), inset 0 0 4px rgba(251,191,36,0.1)',
        }}
      >
        {theme === 'dark' ? (
          // Moon icon
          <svg className="w-3.5 h-3.5 text-yellow-900/70" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
          </svg>
        ) : (
          // Sun icon
          <svg className="w-3.5 h-3.5 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.25a.75.75 0 0 1 .75.75v2.25a.75.75 0 0 1-1.5 0V3a.75.75 0 0 1 .75-.75ZM7.5 12a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0Zm11.394-5.834a.75.75 0 0 0-1.06-1.06l-1.591 1.59a.75.75 0 1 0 1.06 1.061l1.591-1.59ZM21.75 12a.75.75 0 0 1-.75.75h-2.25a.75.75 0 0 1 0-1.5H21a.75.75 0 0 1 .75.75Zm-3.916 6.894a.75.75 0 0 0 1.06-1.06l-1.59-1.591a.75.75 0 1 0-1.061 1.06l1.59 1.591ZM12 18a.75.75 0 0 1 .75.75V21a.75.75 0 0 1-1.5 0v-2.25A.75.75 0 0 1 12 18Zm-4.243-.757a.75.75 0 0 0-1.061-1.06l-1.591 1.59a.75.75 0 0 0 1.06 1.061l1.591-1.59ZM6 12a.75.75 0 0 1-.75.75H3a.75.75 0 0 1 0-1.5h2.25A.75.75 0 0 1 6 12Zm.697-5.834a.75.75 0 0 0 1.06 1.06l1.591-1.59a.75.75 0 0 0-1.06-1.06l-1.591 1.59Z" />
          </svg>
        )}
      </span>
    </button>
  );
}
