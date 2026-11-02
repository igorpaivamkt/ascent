import { useMemo } from 'react';
import { LuArrowRight, LuFlag, LuInfo, LuMountainSnow } from 'react-icons/lu';
import { Link } from '../../app/router';
import { useConfirmedState } from '../../app/store';
import { MOUNTAIN_RULES } from '../../domain/config';
import { resultProgress } from '../../domain/goals';
import { mountainState } from '../../domain/mountain';
import type { Goal } from '../../domain/types';
import { metric, percent } from '../../utils/format';
import { Progress } from '../../components/ui';
import { Mountain } from './Mountain';

/**
 * Montanha + painel da jornada. Exibe SEPARADAMENTE: execução no trecho, marcos validados e resultado medido.
 */
export function Journey({ goal, variant = 'hero', overlay }: { goal: Goal | null; variant?: 'hero' | 'full'; overlay?: boolean }) {
  const state = useConfirmedState();
  const ms = useMemo(() => (goal ? mountainState(state, goal.id) : null), [state, goal]);
  if (!goal || !ms) {
    return (
      <section className="journey" aria-label="Jornada">
        <div style={{ position: 'relative' }}>
          <Mountain goal={null} variant={variant} />
        </div>
        <div className="journey__hud">
          <div className="journey__title"><h2>Sua montanha está esperando</h2></div>
          <p className="muted">Defina um objetivo mensurável para traçar a trilha, os checkpoints e o cume.</p>
          <div><Link to="/metas?novo=1" className="btn btn--primary">Criar meu primeiro objetivo <LuArrowRight /></Link></div>
        </div>
      </section>
    );
  }
  const result = resultProgress(goal);
  const segPct = Math.min(1, ms.segmentPoints / MOUNTAIN_RULES.pointsPerSegment);
  return (
    <section className="journey" aria-label={`Jornada: ${goal.title}`}>
      <div style={{ position: 'relative' }}>
        <Mountain goal={goal} variant={variant} title={goal.title} />
        {overlay && (
          <div className="hero-overlay">
            <h1>{ms.summit ? 'Cume alcançado!' : 'Continue subindo!'}</h1>
            <p>Cada pequena ação te aproxima do seu grande objetivo.</p>
          </div>
        )}
      </div>
      <div className="journey__hud">
        <div className="journey__title">
          <h2>{goal.title}</h2>
          {goal.isPriority && <span className="chip chip--solid"><LuMountainSnow aria-hidden="true" /> Jornada prioritária</span>}
          {state.goals.filter((g) => g.status !== 'archived').length > 1 && variant === 'hero' && (
            <Link to="/montanha" className="card__link" aria-label="Ver todas as montanhas">Montanhas <LuArrowRight /></Link>
          )}
        </div>
        <dl className="journey__metrics">
          <div className="journey__metric">
            <dt>Execução no trecho</dt>
            <dd>{percent(segPct)}</dd>
            <Progress value={segPct} label="Execução no trecho atual" thin striped />
          </div>
          <div className="journey__metric">
            <dt>Marcos</dt>
            <dd>{ms.reachedCount} de {ms.checkpoints.length}</dd>
            <Progress value={ms.checkpoints.length ? ms.reachedCount / ms.checkpoints.length : 0} label="Marcos validados" thin />
          </div>
          <div className="journey__metric">
            <dt>Resultado real</dt>
            <dd>{metric(goal.currentValue, goal.unit)} <span className="muted small">({percent(result)})</span></dd>
            <Progress value={result} label="Resultado medido pelo indicador" thin />
          </div>
        </dl>
        <div className="journey__next">
          <LuFlag aria-hidden="true" />
          {ms.summit ? (
            <span>Objetivo concluído. Defina a próxima jornada quando quiser.</span>
          ) : ms.next ? (
            <span>Próximo checkpoint: <strong>{ms.next.milestone.title}</strong>{ms.next.milestone.rule === 'metric' ? ' — validado pelo indicador' : ' — validação manual'}</span>
          ) : (
            <span>Próximo: <strong>cume ({metric(goal.targetValue, goal.unit)})</strong></span>
          )}
        </div>
        {ms.capped && (
          <p className="note"><LuInfo />Você percorreu com execução todo o trecho possível. O checkpoint chega quando o resultado for medido — ação não é resultado.</p>
        )}
      </div>
    </section>
  );
}
