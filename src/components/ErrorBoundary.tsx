import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { hasError: boolean; error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught error:", error, info);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;
    const isDev = import.meta.env?.DEV;
    return (
      <div className="flex min-h-[200px] w-full items-center justify-center p-6">
        <div className="max-w-md w-full rounded-lg border border-border bg-card p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Algo deu errado ao processar</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Tente novamente. Se o problema continuar, recarregue a página.
            </p>
          </div>
          {isDev && this.state.error && (
            <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-40 whitespace-pre-wrap">
              {String(this.state.error?.message || this.state.error)}
            </pre>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={this.reset}>Tentar novamente</Button>
            <Button onClick={() => window.location.reload()}>Recarregar</Button>
          </div>
        </div>
      </div>
    );
  }
}