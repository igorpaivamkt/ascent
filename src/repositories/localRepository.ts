import { migrateState } from '../domain/initialState';
import type { AppState } from '../domain/types';
import { StorageError, type MediaRepository, type StateRepository } from './types';

/** Interface mínima de armazenamento chave-valor (compatível com window.localStorage). */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  readonly length: number;
}

const STATE_KEY = 'ascent:v1:state';
const MEDIA_PREFIX = 'ascent:v1:media:';

/**
 * Persistência local do protótipo. LIMITAÇÃO DOCUMENTADA: o localStorage não é criptografado e fica
 * restrito a este navegador/dispositivo. Adequado para o protótipo, não para a versão definitiva.
 */
export class LocalStateRepository implements StateRepository {
  constructor(private readonly storage: KeyValueStorage, private readonly now: () => Date = () => new Date()) {}

  async load(): Promise<AppState | null> {
    let raw: string | null;
    try {
      raw = this.storage.getItem(STATE_KEY);
    } catch {
      throw new StorageError('O armazenamento local está indisponível neste navegador.');
    }
    if (!raw) return null;
    return migrateState(JSON.parse(raw), this.now());
  }

  async save(state: AppState): Promise<void> {
    try {
      this.storage.setItem(STATE_KEY, JSON.stringify(state));
    } catch (e) {
      const quota = e instanceof Error && /quota/i.test(e.name + e.message);
      throw new StorageError(quota ? 'Sem espaço no armazenamento local. Remova fotos ou exporte e limpe dados antigos.' : 'Não foi possível salvar os dados.');
    }
  }

  async clear(): Promise<void> {
    this.storage.removeItem(STATE_KEY);
  }
}

export class LocalMediaRepository implements MediaRepository {
  constructor(private readonly storage: KeyValueStorage) {}
  async put(id: string, dataUrl: string): Promise<void> {
    try {
      this.storage.setItem(MEDIA_PREFIX + id, dataUrl);
    } catch {
      throw new StorageError('Sem espaço para salvar a foto neste dispositivo.');
    }
  }
  async get(id: string): Promise<string | null> {
    return this.storage.getItem(MEDIA_PREFIX + id);
  }
  async remove(id: string): Promise<void> {
    this.storage.removeItem(MEDIA_PREFIX + id);
  }
  async clear(): Promise<void> {
    const keys: string[] = [];
    for (let i = 0; i < this.storage.length; i++) {
      const k = this.storage.key(i);
      if (k?.startsWith(MEDIA_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => this.storage.removeItem(k));
  }
}

/** Armazenamento em memória — usado em testes e como fallback quando o navegador bloqueia o localStorage. */
export class MemoryStorage implements KeyValueStorage {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  get length() {
    return this.map.size;
  }
}
