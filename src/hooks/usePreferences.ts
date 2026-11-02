import { useEffect, useState } from 'react';
import { useAppState } from '../app/store';

function useMedia(query: string): boolean {
  const [match, setMatch] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(query).matches);
  useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const mq = matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

/** true quando as animações devem ser reduzidas (preferência do app ou do sistema). */
export function useReducedMotion(): boolean {
  const { settings } = useAppState();
  const system = useMedia('(prefers-reduced-motion: reduce)');
  return settings.motion === 'reduced' || (settings.motion === 'system' && system);
}

export function useResolvedTheme(): 'light' | 'dark' {
  const { settings } = useAppState();
  const systemDark = useMedia('(prefers-color-scheme: dark)');
  return settings.theme === 'system' ? (systemDark ? 'dark' : 'light') : settings.theme;
}

/** Aplica tema e preferência de movimento no <html>. */
export function useDocumentPreferences(): void {
  const theme = useResolvedTheme();
  const reduced = useReducedMotion();
  useEffect(() => {
    document.documentElement.dataset.resolvedTheme = theme;
    document.documentElement.dataset.motion = reduced ? 'reduced' : 'full';
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute('content', theme === 'dark' ? '#0c0c0c' : '#f4f4f2');
  }, [theme, reduced]);
}

export function useIsWide(min = 1024): boolean {
  return useMedia(`(min-width: ${min}px)`);
}

export function useElementWidth<T extends HTMLElement>(ref: { current: T | null }): number {
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}
