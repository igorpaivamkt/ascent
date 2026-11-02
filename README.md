# ASCENT — Personal Life Operating System

**Planeje. Execute. Meça. Aprenda. Evolua.**

Protótipo funcional, mobile-first, que combina objetivos, rotina, finanças e relacionamento com uma jornada de RPG minimalista: um stickman que sobe uma montanha conforme ações validadas são registradas.

> Estado atual: **versão 0.2** — roda no navegador, instala como PWA e funciona offline. Funciona em **modo local** (dados no aparelho) ou com **conta na nuvem** (Supabase): login, sincronização entre aparelhos, fila offline e recompensas validadas no servidor. O backend está pronto e testado contra PostgreSQL real, mas **ainda não foi implantado** num projeto Supabase seu (ver docs/BACKEND.md). Ainda não há IA nem APK gerado.

---

## 1. O que está implementado

| Área | O que funciona de verdade |
|---|---|
| **Montanha** | SVG em camadas, trilha em zigue-zague, checkpoints, acampamentos, cume. Câmera que acompanha o personagem no celular. Posição **derivada do progresso salvo** (recarregar não perde nem duplica). Várias montanhas (uma por objetivo). |
| **Personagem** | Stickman vetorial com membros articulados (cinemática por ângulos). Estados: parado, caminhando, subindo, comemorando, checkpoint e cume. Itens equipados aparecem na montanha. |
| **Fluxo vertical** | Concluir hábito → motor valida → grava → XP → conquista → personagem caminha → XP flutuante e avisos → estado persiste. |
| **Gamificação** | Motor central e puro: XP configurável, níveis `XP(L) = 100 × (L − 1)²`, 9 títulos, 24 conquistas (inclui 1 oculta), moedas, chaves de idempotência, ajustes auditáveis ao desfazer. |
| **Objetivos** | Objetivo → Marco → Projeto → Microetapa → Ação. Criar, editar (com versão do plano), pausar, retomar, concluir (com evidência), arquivar sem apagar histórico. Marcos validados pelo indicador ou manualmente. |
| **Rotina** | Hábitos (diário, dias úteis, dias específicos), conclusão total/parcial, não concluída com motivo, reagendar, não aplicável, tarefas pontuais, filtros por dia e status, sequência atual e melhor sequência, métricas e motivos. |
| **Finanças** | Receitas/despesas, contas, categorias, orçamento por categoria, previsto × pendente × realizado, saldo por conta, saldo projetado, gráfico de 6 meses, despesas por categoria, natureza da receita (renda pessoal ≠ faturamento). |
| **Relacionamento** | Perfil, preferências com grau de certeza e “desatualizada”, datas, desejos, linha do tempo de experiências com fotos (comprimidas, só no dispositivo), gastos vinculados, compromissos, endereço/CEP mascarado com confirmação para exibir. |
| **Inteligência (determinística)** | Linha de base, atual, alvo, diferença, histórico em gráfico, estimativa linear com faixa, R², nível de confiança, pressupostos explícitos — e recusa a estimar quando não há base. Nenhuma frase é apresentada como “IA”. |
| **Loja e inventário** | 17 itens cosméticos implementados (corpo, roupas, mochilas, acessórios, efeitos): gratuitos, por moedas, por nível e por conquista. Compra valida saldo e posse; equipar/desequipar; prévia animada. |
| **Revisão e histórico** | Revisão semanal com dados reais da semana (+XP uma única vez). Histórico com filtros por período, área e objetivo. |
| **Configurações** | Nome, nome da moeda, tema claro/escuro/sistema, animações (sistema/reduzidas/completas), efeitos de comemoração, exportar/importar backup JSON, limpar demonstração, instalar PWA. |
| **PWA** | Manifest, ícones (incl. maskable), service worker com pré-cache gerado no build, abre offline. |
| **Conta e nuvem** | Login por e-mail, sincronização por comandos idempotentes, fila offline, recompensas recalculadas no servidor, livros-razão imutáveis com chave única, RLS por usuário, migração verificada dos dados do aparelho, exclusão de conta. Detalhes em **docs/BACKEND.md**. |

## 2. Arquitetura

```
src/
  domain/              regras de negócio puras (sem React, sem DOM) — testáveis
    engine/            motor de comandos: valida, aplica, concede recompensas, emite efeitos
    config.ts          XP, moedas, regra de avanço na montanha, títulos  ← balanceamento
    achievements.ts    estatísticas + definições de conquistas
    levels.ts          curva de níveis e títulos
    mountain.ts        geometria da trilha + posição do personagem (derivada)
    goals.ts           progresso de resultado e estimativa de prazo
    routine.ts         agenda, taxa de conclusão, sequências
    finance.ts         resumos, orçamento, saldos
    catalog.ts         itens cosméticos
    demo.ts            demonstração construída executando comandos reais do motor
  repositories/        contrato de persistência + implementação localStorage
  app/                 store (dispatch → persistir → animar), roteador por hash, layout
  features/            telas por módulo (dashboard, mountain, goals, routine, finance, …)
  components/          UI reutilizável (modal acessível, progresso, gráficos SVG, avisos)
  services/pwa.ts      registro do service worker (isolado das regras de negócio)
  styles/              tokens de design + estilos
tests/                 testes de domínio (node:test)
scripts/               build/dev (esbuild), testes, verificação de UI e fluxo (Playwright), ícones
```

**Fluxo de uma ação:** `UI → store.dispatch(comando) → execute(estado, comando)` (puro) → `repositório.save(novoEstado)` → só então a interface é atualizada e os efeitos (XP, conquistas, caminhada) são disparados. Se a gravação falhar, nada é aplicado.

**Idempotência:** toda recompensa tem uma chave única (`ach:first_habit`, `ms:<id>`, `review:<semana>`…). Ocorrências, tarefas e microetapas usam “XP líquido por origem”: reenviar não gera nada; desfazer gera um evento de ajuste negativo auditável; refazer não duplica.

**Por que esbuild e não Vite:** o ambiente onde o protótipo foi construído não tinha acesso ao registro npm. Usei apenas pacotes já disponíveis (React 19, react-icons, esbuild, TypeScript). O build é um script curto (`scripts/build.mjs`); migrar para Vite depois é direto, porque o código não depende do bundler. Pelo mesmo motivo existe `src/types/react-shim.d.ts` — ao ter acesso ao npm, instale `@types/react@19 @types/react-dom@19` e apague esse arquivo.

## 3. Comandos

Requer Node.js 20+.

```bash
npm install          # instala React, react-icons, esbuild e TypeScript
npm run dev          # servidor de desenvolvimento com recarga: http://localhost:5173
npm run build        # build de produção em dist/
npm run preview      # serve dist/ em http://localhost:4173 (também no IP da rede local)
npm test             # 75 testes: domínio, sincronização e PostgreSQL real (se instalado)
npm run build:server # empacota a Edge Function do Supabase
npm run mock:cloud   # Supabase local em memória para testar login e sincronização
npm run typecheck    # TypeScript estrito
npm run check:ui     # Playwright: 12 telas × 4 larguras, acessibilidade, roteiro completo (requer preview rodando)
npm run check:flow   # Playwright: fluxo vertical hábito → XP → conquista → montanha → recarregar
npm run check:cloud  # Playwright: conta, offline, sincronização entre dois aparelhos (requer mock:cloud)
```

### Testar no seu celular agora
1. `npm run build && npm run preview` no computador.
2. No celular (mesma rede Wi-Fi), abra `http://IP-DO-COMPUTADOR:4173`.
3. Para instalar como app e testar offline é preciso HTTPS (ou `localhost`). Opções: publicar a pasta `dist/` em qualquer hospedagem estática com HTTPS, ou usar a versão publicada que acompanha esta entrega.

## 4. Como testar as funcionalidades principais

1. **Fluxo vertical:** em Início, marque os hábitos pendentes de “Rotina de hoje”. Veja `+XP`, o personagem caminhar e, ao concluir todos, a conquista **Dia completo**. Recarregue a página: tudo permanece.
2. **Marco/checkpoint:** Metas → “Renda mensal…” → **Registrar resultado** com `5.000` → o checkpoint acende, há comemoração e a trilha recomeça a contar no novo trecho.
3. **Cume:** Metas → “Ler 12 livros” → Registrar resultado `12` → modal de cume com resumo real da jornada.
4. **Desfazer sem duplicar:** marque e desmarque um hábito; o Histórico mostra o ajuste auditável e o XP total volta ao valor anterior.
5. **Loja:** compre um item com moedas, equipe e veja o personagem mudar na montanha.
6. **Finanças:** cadastre uma despesa realizada e uma receita prevista — só a realizada entra no saldo.
7. **Acessibilidade:** Configurações → Animações → Reduzidas: o progresso é aplicado instantaneamente.

## 5. Dados de demonstração

Na primeira abertura o app carrega uma **demonstração fictícia** (banner pontilhado em todas as telas principais). Ela é construída executando comandos reais do motor em datas passadas, então obedece às mesmas regras do uso real.

**Para limpar:** botão “Começar minha jornada” (banner) ou Configurações → “Limpar demonstração e começar”. Um assistente de 4 passos cria seu nome, primeiro objetivo (com marcos sugeridos) e hábitos iniciais. Tema e preferência de animação são mantidos. “Recarregar demonstração” volta ao exemplo.

## 6. Persistência atual

**Com conta (nuvem):** o servidor é a fonte da verdade (ver docs/BACKEND.md). O aparelho guarda uma cópia confirmada e a fila de registros pendentes (`ascent:v1:cloud-snapshot:<usuário>`), apagadas ao sair da conta.

**Sem conta (modo local):**

- Estado inteiro em `localStorage` (`ascent:v1:state`), com versão de esquema e função de migração (`migrateState`).
- Fotos em chaves separadas (`ascent:v1:media:*`), comprimidas para ~900 px.
- Se o navegador bloquear o armazenamento, o app avisa e funciona em memória.
- **Limitação documentada:** localStorage não é criptografado e fica preso a este navegador/dispositivo. Exporte backups (Configurações → Exportar). Não há senhas nem tokens armazenados.

Para trocar por um backend basta implementar `StateRepository`/`MediaRepository` (`src/repositories/types.ts`). Recomendação: Supabase/PostgreSQL com tabelas por entidade (modelo da especificação), RLS por usuário, e o motor de domínio executado no servidor (Edge Function) para que XP, conquistas e moedas não dependam do navegador.

## 7. O que ainda depende de serviço externo

- **Implantar o backend** num projeto Supabase seu (passo a passo em docs/BACKEND.md) — o código está pronto e testado.
- Criptografia por campo de dados sensíveis (endereço/CEP) e armazenamento privado de fotos na nuvem.
- No modo local (sem conta), recompensas continuam calculadas só no aparelho.
- Camada de IA (recomendações, síntese de revisões): a interface indica onde ela entrará; nada é simulado.
- Notificações push e lembretes de hábitos.

## 8. APK Android

Ver **docs/ANDROID.md**. Resumo: a aplicação já está preparada (roteador por hash, caminhos relativos, sem APIs nativas misturadas ao domínio, `capacitor.config.json` pronto). **Nenhum APK foi gerado nem testado ainda** — falta instalar Capacitor e o Android SDK/JDK numa máquina com acesso à internet.

## 9. Problemas conhecidos

- Tipos de React vêm de um shim mínimo (ver seção 2); a checagem de props em elementos HTML é mais frouxa que com `@types/react`.
- Inputs de data usam o seletor nativo do sistema; no Chrome desktop em inglês o formato aparece como mm/dd/aaaa.
- Fotos grandes podem esgotar a cota do localStorage (~5 MB); o app avisa, mas não há compressão adaptativa.
- Revisão mensal do relacionamento e cenários financeiros (conservador/base/otimista) ainda não foram implementados.
- O motor recalcula estatísticas sobre o estado inteiro a cada ação; adequado para meses de uso, mas deve migrar para agregados no backend.

## 10. Próximas etapas recomendadas

1. **Validar no celular** (navegação, montanha, formulários, persistência) e gerar um APK de teste — em paralelo.
2. **Implantar o backend** no Supabase (docs/BACKEND.md) e testar a sincronização entre dois aparelhos reais.
3. **Inteligência de metas:** funil (abordagens → reuniões → propostas → clientes), ticket e margem, capacidade de entrega, recorrência, origem do crescimento, cenários com incerteza e diagnóstico de gargalos — calculados no servidor sobre o histórico confiável.
4. Finanças e relacionamento integrados (amortizações, recorrências, patrimônio, revisões mensais, múltiplos perfis).
5. Recomendações com IA sobre esse histórico, com aceitar/editar/rejeitar.

Regras detalhadas de XP, níveis e avanço: **docs/REGRAS.md**.
