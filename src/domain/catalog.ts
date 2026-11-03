import type { Slot } from './types';

/** Itens cosméticos. A loja é exclusivamente cosmética: nada aqui altera progresso ou indicadores. */
export type Unlock =
  | { type: 'default' }
  | { type: 'coins'; price: number }
  | { type: 'level'; level: number }
  | { type: 'achievement'; code: string };

export type ShopCategory = 'personagem' | 'roupa' | 'mochila' | 'acessorio' | 'efeito' | 'cenario';

export interface CosmeticItem {
  id: string;
  name: string;
  description: string;
  slot: Slot;
  category: ShopCategory;
  unlock: Unlock;
  /** Coleção temática (aparece como etiqueta na loja). */
  collection?: string;
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

  // ── Coleção Leitor (conquistas de leitura)
  { id: 'head-glasses', name: 'Óculos de leitura', description: 'Para quem já passou das cem páginas.', slot: 'head', category: 'acessorio', collection: 'Leitor', unlock: { type: 'achievement', code: 'read_100' } },
  { id: 'hand-book', name: 'Livro aberto', description: 'O primeiro livro concluído vai junto na subida.', slot: 'hand', category: 'acessorio', collection: 'Leitor', unlock: { type: 'achievement', code: 'book_1' } },
  { id: 'outfit-cardigan', name: 'Cardigã do leitor', description: 'Conforto de biblioteca, para quem já leu cinco livros.', slot: 'outfit', category: 'roupa', collection: 'Leitor', unlock: { type: 'achievement', code: 'book_5' } },
  { id: 'fx-pages', name: 'Páginas ao vento', description: 'Folhas voando na comemoração. Doze livros lidos.', slot: 'fx', category: 'efeito', collection: 'Leitor', unlock: { type: 'achievement', code: 'book_12' } },
  // ── Coleção Herói (compromissos)
  { id: 'head-hero-mask', name: 'Máscara de herói', description: 'Identidade secreta de quem cumpre o que promete. 50 tarefas.', slot: 'head', category: 'acessorio', collection: 'Herói', unlock: { type: 'achievement', code: 'tasks_50' } },
  { id: 'outfit-hero-cape', name: 'Capa heroica', description: 'Capa vermelha com o emblema da montanha. 100 tarefas.', slot: 'outfit', category: 'roupa', collection: 'Herói', unlock: { type: 'achievement', code: 'tasks_100' } },
  { id: 'head-halo', name: 'Auréola', description: 'Quatro semanas sem deixar nada para trás.', slot: 'head', category: 'acessorio', collection: 'Herói', unlock: { type: 'achievement', code: 'clean_week_4' } },
  { id: 'fx-lightning', name: 'Raios', description: 'Energia de super-herói na comemoração.', slot: 'fx', category: 'efeito', collection: 'Herói', unlock: { type: 'coins', price: 260 } },
  // ── Coleção Galáxia (ficção científica)
  { id: 'head-astronaut', name: 'Capacete espacial', description: 'Visor de astronauta para cumes fora da órbita.', slot: 'head', category: 'acessorio', collection: 'Galáxia', unlock: { type: 'coins', price: 450 } },
  { id: 'hand-plasma', name: 'Espada de plasma', description: 'Lâmina de energia de cavaleiro espacial.', slot: 'hand', category: 'acessorio', collection: 'Galáxia', unlock: { type: 'coins', price: 400 } },
  { id: 'pack-jetpack', name: 'Mochila a jato', description: 'Dois propulsores com chama acesa.', slot: 'pack', category: 'mochila', collection: 'Galáxia', unlock: { type: 'coins', price: 500 } },
  { id: 'body-robot', name: 'Robô', description: 'Cabeça quadrada, antena e olhos de LED.', slot: 'body', category: 'personagem', collection: 'Galáxia', unlock: { type: 'coins', price: 400 } },
  { id: 'fx-stars', name: 'Chuva de estrelas', description: 'Estrelas caindo em volta do personagem.', slot: 'fx', category: 'efeito', collection: 'Galáxia', unlock: { type: 'coins', price: 220 } },
  // ── Coleção Fantasia
  { id: 'head-wizard', name: 'Chapéu de mago', description: 'Pontudo, com estrelas bordadas.', slot: 'head', category: 'acessorio', collection: 'Fantasia', unlock: { type: 'coins', price: 300 } },
  { id: 'hand-staff', name: 'Cajado do mago', description: 'Cajado de madeira com uma esfera brilhante.', slot: 'hand', category: 'acessorio', collection: 'Fantasia', unlock: { type: 'coins', price: 280 } },
  { id: 'head-viking', name: 'Elmo viking', description: 'Chifres para enfrentar o frio do norte.', slot: 'head', category: 'acessorio', collection: 'Fantasia', unlock: { type: 'coins', price: 300 } },
  // ── Coleção Aventura
  { id: 'head-pirate', name: 'Chapéu pirata', description: 'Tricórnio com caveira e tapa-olho.', slot: 'head', category: 'acessorio', collection: 'Aventura', unlock: { type: 'coins', price: 250 } },
  { id: 'head-ninja', name: 'Faixa ninja', description: 'Faixa amarrada com as pontas ao vento.', slot: 'head', category: 'acessorio', collection: 'Aventura', unlock: { type: 'coins', price: 220 } },
  { id: 'hand-katana', name: 'Katana', description: 'Lâmina curva para cortar a procrastinação.', slot: 'hand', category: 'acessorio', collection: 'Aventura', unlock: { type: 'coins', price: 300 } },
  { id: 'head-detective', name: 'Chapéu de detetive', description: 'Aba curta e fita escura, estilo noir.', slot: 'head', category: 'acessorio', collection: 'Aventura', unlock: { type: 'coins', price: 200 } },
  { id: 'hand-magnifier', name: 'Lupa', description: 'Para investigar onde a rotina falhou.', slot: 'hand', category: 'acessorio', collection: 'Aventura', unlock: { type: 'coins', price: 150 } },
  // ── Coleção Geek
  { id: 'head-headset', name: 'Fone gamer', description: 'Headset com microfone. Partida rankeada da vida real.', slot: 'head', category: 'acessorio', collection: 'Geek', unlock: { type: 'coins', price: 180 } },
  { id: 'hand-controller', name: 'Controle', description: 'Controle de videogame na mão.', slot: 'hand', category: 'acessorio', collection: 'Geek', unlock: { type: 'coins', price: 200 } },
  { id: 'outfit-labcoat', name: 'Jaleco de cientista', description: 'Para experimentos de rotina.', slot: 'outfit', category: 'roupa', collection: 'Geek', unlock: { type: 'coins', price: 260 } },
  { id: 'body-neon', name: 'Neon', description: 'Traço brilhante de fliperama.', slot: 'body', category: 'personagem', collection: 'Geek', unlock: { type: 'coins', price: 350 } },
  // ── Conquistas de rotina
  { id: 'outfit-belt', name: 'Faixa de lutador', description: 'Faixa preta e gola de quimono. Cem hábitos de saúde.', slot: 'outfit', category: 'roupa', collection: 'Atleta', unlock: { type: 'achievement', code: 'health_100' } },
  { id: 'head-grad', name: 'Capelo', description: 'Chapéu de formatura. 50 hábitos de estudo.', slot: 'head', category: 'acessorio', collection: 'Estudos', unlock: { type: 'achievement', code: 'study_50' } },
  { id: 'hand-coinbag', name: 'Saco de moedas', description: 'Três meses com o cofrinho em dia.', slot: 'hand', category: 'acessorio', collection: 'Poupador', unlock: { type: 'achievement', code: 'savings_3' } },
  { id: 'fx-hearts', name: 'Corações', description: 'Comemoração com corações subindo.', slot: 'fx', category: 'efeito', unlock: { type: 'coins', price: 150 } },

  // ── Cenários da montanha
  { id: 'scene-classic', name: 'Clássico', description: 'Preto e branco, acompanha o tema do app.', slot: 'scene', category: 'cenario', unlock: { type: 'default' } },
  { id: 'scene-sunset', name: 'Pôr do sol', description: 'Céu laranja e montanhas em tons de vinho.', slot: 'scene', category: 'cenario', unlock: { type: 'coins', price: 300 } },
  { id: 'scene-autumn', name: 'Outono', description: 'Encostas cor de ferrugem e céu dourado.', slot: 'scene', category: 'cenario', unlock: { type: 'coins', price: 350 } },
  { id: 'scene-winter', name: 'Inverno', description: 'Tudo coberto de neve, com flocos caindo.', slot: 'scene', category: 'cenario', unlock: { type: 'coins', price: 350 } },
  { id: 'scene-night', name: 'Noite estrelada', description: 'Lua cheia e estrelas piscando.', slot: 'scene', category: 'cenario', unlock: { type: 'coins', price: 400 } },
  { id: 'scene-canyon', name: 'Cânion', description: 'Rocha vermelha e sol de deserto.', slot: 'scene', category: 'cenario', unlock: { type: 'coins', price: 450 } },
  { id: 'scene-volcano', name: 'Vulcão', description: 'Cume em brasa, fumaça e céu de cinzas.', slot: 'scene', category: 'cenario', unlock: { type: 'coins', price: 600 } },
  { id: 'scene-synthwave', name: 'Synthwave', description: 'Sol listrado, grade neon e céu roxo de anos 80.', slot: 'scene', category: 'cenario', unlock: { type: 'coins', price: 700 } },
  { id: 'scene-alien', name: 'Planeta distante', description: 'Montanhas violeta sob um planeta com anéis.', slot: 'scene', category: 'cenario', unlock: { type: 'coins', price: 800 } },
  { id: 'scene-aurora', name: 'Aurora boreal', description: 'Luzes verdes dançando no céu. Nível 10.', slot: 'scene', category: 'cenario', unlock: { type: 'level', level: 10 } },
];

export const DEFAULT_EQUIPPED = { body: 'body-classic', outfit: null, pack: 'pack-day', head: null, hand: null, fx: 'fx-sparks', scene: 'scene-classic' } as const;

export const SHOP_CATEGORIES: { id: ShopCategory; label: string }[] = [
  { id: 'personagem', label: 'Personagem' },
  { id: 'roupa', label: 'Roupas' },
  { id: 'mochila', label: 'Mochilas' },
  { id: 'acessorio', label: 'Acessórios' },
  { id: 'efeito', label: 'Efeitos' },
  { id: 'cenario', label: 'Cenários' },
];

export function getItem(id: string): CosmeticItem | undefined {
  return CATALOG.find((i) => i.id === id);
}

/** Slots que sempre precisam de um item (não podem ser desequipados). */
export const REQUIRED_SLOTS: Slot[] = ['body', 'scene'];
