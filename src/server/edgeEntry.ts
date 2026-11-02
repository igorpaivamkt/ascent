// Ponto de entrada empacotado para a Edge Function (ver scripts/build-server.mjs).
import { parseUsernameList } from '../domain/accounts';
import { accessRule, supabaseAdmin } from './admin';
import { createHandler, supabaseAuthenticator, supabaseSignup } from './http';
import { SupabaseDb } from './supabaseDb';

export interface EdgeEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ASCENT_ALLOWED_ORIGINS?: string;
  /** Ids (UUID) das contas administradoras, separados por vírgula. Não são segredo. */
  ASCENT_ADMIN_IDS?: string;
  /**
   * Opcional: nomes liberados para criar a própria conta na tela de acesso ("a,b").
   * Vazio = cadastro fechado; as contas são criadas pelo administrador.
   */
  ASCENT_USERNAMES?: string;
}

export function createEdgeHandler(env: EdgeEnv, fetchImpl: typeof fetch = (...a) => fetch(...a)) {
  const db = new SupabaseDb(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const usernames = parseUsernameList(env.ASCENT_USERNAMES);
  const adminIds = (env.ASCENT_ADMIN_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return createHandler({
    db,
    authenticate: supabaseAuthenticator(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, fetchImpl, accessRule(adminIds, usernames)),
    deleteAccount: (userId) => db.deleteAccount(userId),
    signup: supabaseSignup(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, usernames, fetchImpl),
    admin: supabaseAdmin(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, adminIds, usernames, fetchImpl),
    allowedOrigins: env.ASCENT_ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean),
  });
}
