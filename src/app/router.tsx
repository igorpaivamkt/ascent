import { useEffect, useState, type ReactNode } from 'react';

/**
 * Roteador por hash (#/rota). Funciona em hospedagem estática, como PWA instalado e dentro do
 * WebView do Capacitor sem configuração de servidor.
 */
function currentPath(): string {
  const h = typeof location !== 'undefined' ? location.hash.replace(/^#/, '') : '';
  // Retornos do Supabase Auth (#access_token=…, #error=…) não são rotas: vão para a tela de conta.
  if (/^(access_token|error|type)=/.test(h)) return '/configuracoes';
  return h.split('?')[0] || '/';
}

export function navigate(to: string, opts: { replace?: boolean } = {}): void {
  const url = `#${to}`;
  try {
    if (opts.replace) history.replaceState(null, '', url);
    else history.pushState(null, '', url);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } catch {
    // Ambientes restritos (iframes sandbox) podem bloquear a History API: usa o hash diretamente.
    location.hash = url;
  }
}

export function usePath(): string {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const on = () => setPath(currentPath());
    window.addEventListener('hashchange', on);
    window.addEventListener('popstate', on);
    return () => {
      window.removeEventListener('hashchange', on);
      window.removeEventListener('popstate', on);
    };
  }, []);
  return path;
}

export function matchRoute(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split('/').filter(Boolean);
  const b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

export function isActive(to: string, path: string): boolean {
  return to === '/' ? path === '/' : path === to || path.startsWith(`${to}/`);
}

interface LinkProps {
  to: string;
  children?: ReactNode;
  className?: string;
  'aria-label'?: string;
  onClick?: () => void;
  current?: boolean;
}

export function Link({ to, children, className, onClick, current, ...rest }: LinkProps) {
  return (
    <a href={`#${to}`} className={className} aria-current={current ? 'page' : undefined} onClick={onClick} {...rest}>
      {children}
    </a>
  );
}
