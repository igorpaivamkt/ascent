/**
 * Contas por nome de usuário. O Supabase Auth exige um e-mail, então cada usuário recebe um endereço
 * interno no domínio reservado `.invalid` (RFC 2606): nunca recebe mensagens e não pertence a ninguém.
 * A conta é criada já confirmada pelo servidor; nenhum e-mail é enviado.
 */
export const USERNAME_DOMAIN = 'ascent.invalid';
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 72; // limite do bcrypt usado pelo Supabase Auth

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Devolve a mensagem de erro, ou null se o nome for válido. */
export function usernameError(u: string): string | null {
  if (!u) return 'Informe o nome de usuário.';
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(u)) return 'Use de 3 a 30 caracteres: letras sem acento, números, ponto, hífen ou sublinhado.';
  return null;
}

export function passwordError(p: string): string | null {
  if (p.length < PASSWORD_MIN) return `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`;
  if (p.length > PASSWORD_MAX) return `A senha pode ter no máximo ${PASSWORD_MAX} caracteres.`;
  return null;
}

export const usernameToEmail = (u: string): string => `${u}@${USERNAME_DOMAIN}`;

/** Nome de usuário a partir do e-mail interno (ou null se a conta não for por usuário). */
export function emailToUsername(email: string | null | undefined): string | null {
  const suffix = `@${USERNAME_DOMAIN}`;
  return email && email.toLowerCase().endsWith(suffix) ? email.slice(0, -suffix.length).toLowerCase() : null;
}

/** Lista de usuários liberados, a partir de "a, b ,c". Vazia = sem restrição definida. */
export function parseUsernameList(raw: string | undefined | null): string[] {
  return (raw ?? '').split(',').map(normalizeUsername).filter(Boolean);
}
