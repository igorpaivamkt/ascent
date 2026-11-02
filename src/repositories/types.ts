import type { AppState } from '../domain/types';

/**
 * Contrato de persistência. A interface nunca fala com o armazenamento diretamente:
 * trocar localStorage por uma API (Supabase/PostgreSQL) ou pelo armazenamento nativo do Capacitor
 * exige apenas uma nova implementação deste contrato.
 */
export interface StateRepository {
  load(): Promise<AppState | null>;
  save(state: AppState): Promise<void>;
  clear(): Promise<void>;
}

/** Fotos ficam fora do documento principal para não inflar cada gravação. */
export interface MediaRepository {
  put(id: string, dataUrl: string): Promise<void>;
  get(id: string): Promise<string | null>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

export class StorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageError';
  }
}
