import { Component, type ErrorInfo, type ReactNode } from 'react';
import { diag } from '../../lib/diag';

interface Props {
  children: ReactNode;
  onReset: () => void;
}

interface State {
  error: Error | null;
}

/**
 * Ловит сбой отрисовки. Без него React размонтирует всё дерево,
 * и игрок видит просто чёрный экран без единой подсказки.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    diag('сбой отрисовки', error.message);
    console.error('Сбой отрисовки:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="screen">
        <div className="card center" style={{ padding: 26, marginTop: 40 }}>
          <div style={{ fontSize: 42 }}>🎩</div>
          <h3 style={{ fontSize: 20, fontWeight: 700, marginTop: 12 }}>Что-то сломалось</h3>
          <p className="muted" style={{ marginTop: 8 }}>
            Партия продолжается у остальных — вы можете вернуться на главный экран и подключиться заново.
          </p>
          <details style={{ marginTop: 16, textAlign: 'left', width: '100%' }}>
            <summary className="muted" style={{ fontSize: 13, cursor: 'pointer' }}>
              Подробности для отчёта
            </summary>
            <pre
              className="mono"
              style={{
                fontSize: 11,
                marginTop: 10,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                opacity: 0.7,
              }}
            >
              {error.message}
              {'\n'}
              {error.stack?.split('\n').slice(1, 5).join('\n')}
            </pre>
          </details>
          <button
            className="btn primary block"
            style={{ marginTop: 18 }}
            onClick={() => {
              this.setState({ error: null });
              this.props.onReset();
            }}
          >
            На главный экран
          </button>
        </div>
      </div>
    );
  }
}
