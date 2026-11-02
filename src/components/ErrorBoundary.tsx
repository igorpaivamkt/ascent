import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  /** Muda quando a tela muda: o erro de uma tela não impede abrir as outras. */
  resetKey?: string;
}
interface State {
  error: Error | null;
  key?: string;
}

/**
 * Se uma tela quebrar, mostra um aviso com saída em vez de deixar o app inteiro em branco.
 * Os dados já salvos não são afetados: o erro é só de exibição.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, key: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Falha ao exibir a tela', error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <section className="card" role="alert" style={{ maxWidth: 560 }}>
        <h1 style={{ marginBottom: 8 }}>Esta tela não abriu</h1>
        <p className="muted small" style={{ marginBottom: 14 }}>Algo deu errado ao mostrar esta parte do app. Seus dados salvos não foram perdidos.</p>
        <div className="row">
          <button className="btn btn--primary" onClick={() => location.reload()}>Recarregar</button>
          <a className="btn" href="#/" onClick={() => this.setState({ error: null })}>Ir para o início</a>
        </div>
        <details style={{ marginTop: 12 }}>
          <summary className="xs muted">Detalhe técnico</summary>
          <pre className="xs muted" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{this.state.error.message}</pre>
        </details>
      </section>
    );
  }
}
