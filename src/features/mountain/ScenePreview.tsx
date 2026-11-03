import { Scenery, sceneClass } from './Scenery';

/** Miniatura de um cenário da montanha (loja). */
export function ScenePreview({ id, label }: { id: string; label?: string }) {
  return (
    <div className={`scene-thumb ${sceneClass(id)}`}>
      <svg viewBox="180 20 820 600" preserveAspectRatio="xMidYMid slice" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={{ display: 'block', width: '100%', height: '100%' }}>
        <Scenery theme={id} />
      </svg>
    </div>
  );
}
