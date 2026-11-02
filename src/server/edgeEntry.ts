// Ponto de entrada empacotado para a Edge Function (ver scripts/build-server.mjs).
import { emailToUsername, parseUsernameList } from '../domain/accounts';
import { createHandler, supabaseAuthenticator, supabaseSignup } from './http';
import { SupabaseDb } from './supabaseDb';

export interface EdgeEnv {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  ASCENT_ALLOWED_ORIGINS?: string;
  /**
   * Usuários liberados, separados por vírgula (ex.: "igorpaiva,eduardogomes").
   * Definida: só esses nomes podem se cadastrar e sincronizar. Vazia: cadastro por usuário fechado.
   */
  ASCENT_USERNAMES?: string;
}

export function createEdgeHandler(env: EdgeEnv, fetchImpl: typeof fetch = (...a) => fetch(...a)) {
  const db = new SupabaseDb(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const allowed = parseUsernameList(env.ASCENT_USERNAMES);
  const allowUser = allowed.length ? (email: string) => allowed.includes(emailToUsername(email) ?? '') : undefined;
  return createHandler({
    db,
    authenticate: supabaseAuthenticator(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, fetchImpl, allowUser),
    deleteAccount: (userId) => db.deleteAccount(userId),
    signup: supabaseSignup(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, allowed, fetchImpl),
    allowedOrigins: env.ASCENT_ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean),
  });
}
