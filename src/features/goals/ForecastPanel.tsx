import { LuChartLine, LuInfo } from 'react-icons/lu';
import { formatDate } from '../../domain/dates';
import { gapToTarget, type Forecast } from '../../domain/goals';
import type { Goal, MetricObservation } from '../../domain/types';
import { LineChart } from '../../components/charts';
import { metric } from '../../utils/format';

/** Inteligência de metas (determinística): linha de base, diferença, tendência e estimativa com pressupostos explícitos. */
export function ForecastPanel({ goal, observations, forecast }: { goal: Goal; observations: MetricObservation[]; forecast: Forecast }) {
  const points = observations.map((o) => ({ label: formatDate(o.date), value: o.value }));
  return (
    <section className="card" aria-labelledby={`fc-${goal.id}`}>
      <div className="card__head"><h2 id={`fc-${goal.id}`}><LuChartLine aria-hidden="true" /> Resultado e projeção</h2></div>
      <dl className="kv">
        <div><dt>Linha de base</dt><dd>{metric(goal.baselineValue, goal.unit)}</dd></div>
        <div><dt>Atual</dt><dd>{metric(goal.currentValue, goal.unit)}</dd></div>
        <div><dt>Alvo</dt><dd>{metric(goal.targetValue, goal.unit)}</dd></div>
        <div><dt>Diferença até a meta</dt><dd>{metric(gapToTarget(goal), goal.unit)}</dd></div>
      </dl>
      {points.length > 1 && (
        <div style={{ marginTop: 12 }}>
          <LineChart label={`Histórico de ${goal.metricName}`} points={points} target={goal.targetValue} format={(n) => metric(n, goal.unit)} height={170} />
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        {forecast.status === 'ok' ? (
          <div className="forecast">
            <p>
              <strong>Estimativa preliminar:</strong> {formatDate(forecast.estimate, { year: true })}
              <span className="muted"> (faixa: {formatDate(forecast.rangeStart, { year: true })} – {forecast.rangeEnd ? formatDate(forecast.rangeEnd, { year: true }) : 'indeterminado'})</span>
            </p>
            <p className="small">Ritmo observado: {metric(forecast.ratePerMonth, goal.unit)}/mês · {forecast.observations} medições entre {formatDate(forecast.period.from)} e {formatDate(forecast.period.to)} · R² {forecast.r2.toFixed(2)} · <span className={`tag ${forecast.confidence === 'baixa' ? 'tag--warn' : ''}`}>confiança {forecast.confidence}</span></p>
            <ul className="small muted assumptions">
              {forecast.assumptions.map((a) => <li key={a}>{a}</li>)}
            </ul>
          </div>
        ) : (
          <p className="note small"><LuInfo />{forecast.message}</p>
        )}
      </div>
      <p className="xs muted" style={{ marginTop: 10 }}>Recomendações por IA: a integração será feita por uma camada de serviço segura e ainda não está ativa. Nada aqui é gerado por IA.</p>
    </section>
  );
}
