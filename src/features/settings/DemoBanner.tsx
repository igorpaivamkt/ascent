import { LuInfo } from 'react-icons/lu';
import { Link } from '../../app/router';
import { useAppState } from '../../app/store';

/** Identifica claramente que os dados exibidos são de demonstração. */
export function DemoBanner() {
  const { mode } = useAppState();
  if (mode !== 'demo') return null;
  return (
    <div className="demo-banner" role="note">
      <LuInfo aria-hidden="true" />
      <p>
        <strong>Você está explorando dados de demonstração.</strong> Valores, perfil e histórico são fictícios. Registros feitos agora serão apagados quando você iniciar sua jornada.
      </p>
      <Link to="/inicio" className="btn btn--primary btn--sm">Começar minha jornada</Link>
    </div>
  );
}
