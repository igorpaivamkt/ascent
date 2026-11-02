# Regras do motor (v0.1)

Todos os valores ficam em `src/domain/config.ts`. Alterá-los não reescreve eventos já registrados.

## XP
| Evento | XP | Observação |
|---|---|---|
| Hábito concluído | 5 | parcial = 2; parcial → concluído soma exatamente 5 |
| Tarefa concluída | 10 | |
| Microetapa | 20 | |
| Missão (todas as microetapas de um projeto) | 50 | + 30 moedas, uma vez por projeto |
| Marco validado | 100 | + 50 moedas |
| Objetivo concluído | 200 | + 100 moedas |
| Revisão semanal | 25 | + 15 moedas, uma vez por semana |
| Resultado registrado | 15 | uma vez por objetivo por dia |
| Experiência de relacionamento | 10 | no máximo uma por dia |
| Compromisso cumprido | 10 | |
| Conquistas | variável | ver `achievements.ts` |

- Cada evento tem chave de idempotência única. Ocorrências/tarefas/microetapas usam XP líquido por origem: desfazer gera ajuste negativo auditável; refazer não duplica.
- Projetos concluídos não podem ser excluídos nem ter microetapas reabertas (apenas arquivados).
- Conquistas e níveis desbloqueados nunca são removidos por descanso, pausa ou falha.

## Níveis
`XP(L) = 100 × (L − 1)²` → nível 2: 100, 3: 400, 4: 900, 5: 1.600, 10: 8.100, 20: 36.100. Cada subida concede 25 moedas. O nível do jogo não é requisito para resultado real nenhum.

## Montanha
- Cada objetivo é uma montanha; marcos = checkpoints igualmente espaçados; o cume = alvo.
- Pontos de execução: hábito 2 (parcial 1), tarefa 3, microetapa 5, missão 10. Hábitos sem objetivo avançam a jornada prioritária.
- Um trecho entre checkpoints vale 120 pontos, mas a execução sozinha percorre no máximo 90% dele.
- O checkpoint só é alcançado quando o marco é validado (pelo indicador ou manualmente). Ao alcançá-lo, a contagem do trecho seguinte recomeça.
- Posição = (marcos alcançados + fração do trecho) ÷ (marcos + 1). Mesmo histórico → mesma posição.
- A interface mostra separadamente: execução no trecho, marcos validados e resultado real do indicador.

## Rotina
- Taxa = concluídas ÷ elegíveis. "Não aplicável" e "reagendada" saem do denominador (a reagendada conta no novo dia). Dias futuros não contam; hoje só conta o que já foi registrado.
- Sequência = dias consecutivos com ao menos uma ação concluída; a melhor sequência é preservada.

## Estimativa de prazo
Calculada apenas com ≥ 3 medições em datas diferentes, ≥ 28 dias de histórico, tendência na direção da meta e R² ≥ 0,5. Regressão linear; faixa = ± 1 erro-padrão da inclinação; confiança baixa/média/alta pelo número de pontos e R². Caso contrário, o app informa por que não estima.
