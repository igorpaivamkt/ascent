import type { CloudConfig } from './auth';

declare const __ASCENT_CLOUD__: { url: string; anonKey: string } | null;
const RUNTIME_KEY = 'ascent:v1:cloud-config';

/**
 * Configuração do servidor: definida no build (ASCENT_SUPABASE_URL / ASCENT_SUPABASE_ANON_KEY) ou,
 * em testes, informada em Configurações. A anon key é pública por natureza (a segurança vem do RLS);
 * a service_role key NUNCA entra no aplicativo.
 */
export function getCloudConfig(): CloudConfig | null {
  const built = typeof __ASCENT_CLOUD__ !== 'undefined' ? __ASCENT_CLOUD__ : null;
  if (built?.url && built.anonKey) return built;
  try {
    const raw = localStorage.getItem(RUNTIME_KEY);
    const c = raw ? (JSON.parse(raw) as CloudConfig) : null;
    return c?.url && c.anonKey ? c : null;
  } catch {
    return null;
  }
}

export function isBuiltInConfig(): boolean {
  return typeof __ASCENT_CLOUD__ !== 'undefined' && !!__ASCENT_CLOUD__?.url;
}

export function saveRuntimeCloudConfig(c: CloudConfig | null): void {
  try {
    if (c) localStorage.setItem(RUNTIME_KEY, JSON.stringify({ url: c.url.replace(/\/+$/, ''), anonKey: c.anonKey.trim() }));
    else localStorage.removeItem(RUNTIME_KEY);
  } catch {
    /* indisponível */
  }
}
