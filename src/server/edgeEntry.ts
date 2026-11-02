// Ponto de entrada empacotado para a Edge Function (ver scripts/build-server.mjs).
import { createHandler, supabaseAuthenticator } from './http';
import { SupabaseDb } from './supabaseDb';

export interface EdgeEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ASCENT_ALLOWED_ORIGINS?: string;
}

export function createEdgeHandler(env: EdgeEnv) {
  const db = new SupabaseDb(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  return createHandler({
    db,
    authenticate: supabaseAuthenticator(env.SUPABASE_URL, env.SUPABASE_ANON_KEY),
    deleteAccount: (userId) => db.deleteAccount(userId),
    allowedOrigins: env.ASCENT_ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean),
  });
}
