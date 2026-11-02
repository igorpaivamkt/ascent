import type { Slot } from './types';

/** Itens cosméticos. A loja é exclusivamente cosmética: nada aqui altera progresso ou indicadores. */
export type Unlock =
  | { type: 'default' }
  | { type: 'coins'; price: number }
  | { type: 'level'; level: number }
  | { type: 'achievement'; code: string };

export type ShopCategory = 'personagem' | 'roupa' | 'mochila' | 'acessorio' | 'efeito';

export interface CosmeticItem {
  id: string;
  name: string;
  description: string;
  slot: Slot;
  category: ShopCategory;
  unlock: Unlock;
}

export const CATALOG: CosmeticItem[] = [
  // Personagem (corpo)
  { id: 'body-classic', name: 'Padrão', description: 'O stickman original do ASCENT.', slot: 'body', category: 'personagem', unlock: { type: 'default' } },
  { id: 'body-outline', name: 'Contorno', description: 'Traço leve com cabeça vazada.', slot: 'body', category: 'personagem', unlock: { type: 'coins', price: 200 } },
  { id: 'body-bold', name: 'Robusto', description: 'Traço mais firme para quem já tem estrada.', slot: 'body', category: 'personagem', unlock: { type: 'level', level: 3 } },
  { id: 'body-mist', name: 'Névoa', description: 'Tom de cinza de quem treina nas nuvens.', slot: 'body', category: 'personagem', unlock: { type: 'achievement', code: 'streak_7' } },
  // Roupas
  { id: 'outfit-scarf', name: 'Cachecol', description: 'Para as altitudes mais frias.', slot: 'outfit', category: 'roupa', unlock: { type: 'coins', price: 120 } },
  { id: 'outfit-vest', name: 'Colete de trilha', description: 'Bolsos para cada microetapa.', slot: 'outfit', category: 'roupa', unlock: { type: 'level', level: 5 } },
  { id: 'outfit-cape', name: 'Capa do Marco', description: 'Concedida a quem valida o primeiro marco.', slot: 'outfit', category: 'roupa', unlock: { type: 'achievement', code: 'first_milestone' } },
  // Mochilas
  { id: 'pack-day', name: 'Mochila de trilha', description: 'Leve e suficiente para começar.', slot: 'pack', category: 'mochila', unlock: { type: 'default' } },
  { id: 'pack-expedition', name: 'Mochila de expedição', description: 'Com saco de dormir para jornadas longas.', slot: 'pack', category: 'mochila', unlock: { type: 'coins', price: 180 } },
  // Acessórios
  { id: 'head-bandana', name: 'Bandana', description: 'Foco no próximo passo.', slot: 'head', category: 'acessorio', unlock: { type: 'coins', price: 80 } },
  { id: 'head-explorer', name: 'Chapéu de explorador', description: 'Aba larga para o sol da subida.', slot: 'head', category: 'acessorio', unlock: { type: 'coins', price: 150 } },
  { id: 'head-helmet', name: 'Capacete de escalada', description: 'Para trechos técnicos.', slot: 'head', category: 'acessorio', unlock: { type: 'level', level: 5 } },
  { id: 'head-crown', name: 'Coroa do cume', description: 'Reservada a quem alcança o nível 10.', slot: 'head', category: 'acessorio', unlock: { type: 'level', level: 10 } },
  { id: 'hand-pole', name: 'Bastão de caminhada', description: 'Apoio extra nas subidas.', slot: 'hand', category: 'acessorio', unlock: { type: 'coins', price: 60 } },
  // Efeitos de comemoração
  { id: 'fx-sparks', name: 'Faíscas', description: 'Celebração discreta.', slot: 'fx', category: 'efeito', unlock: { type: 'default' } },
  { id: 'fx-confetti', name: 'Confete', description: 'Celebração com papel picado monocromático.', slot: 'fx', category: 'efeito', unlock: { type: 'coins', price: 100 } },
  { id: 'fx-banner', name: 'Estandarte', description: 'Ergue um estandarte ao concluir uma missão.', slot: 'fx', category: 'efeito', unlock: { type: 'achievement', code: 'first_mission' } },
];

export const DEFAULT_EQUIPPED = { body: 'body-classic', outfit: null, pack: 'pack-day', head: null, hand: null, fx: 'fx-sparks' } as const;

export const SHOP_CATEGORIES: { id: ShopCategory; label: string }[] = [
  { id: 'personagem', label: 'Personagem' },
  { id: 'roupa', label: 'Roupas' },
  { id: 'mochila', label: 'Mochilas' },
  { id: 'acessorio', label: 'Acessórios' },
  { id: 'efeito', label: 'Efeitos' },
];

export function getItem(id: string): CosmeticItem | undefined {
  return CATALOG.find((i) => i.id === id);
}

/** Slots que sempre precisam de um item (não podem ser desequipados). */
export const REQUIRED_SLOTS: Slot[] = ['body'];
