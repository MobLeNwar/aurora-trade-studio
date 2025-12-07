import React, { Component, ErrorInfo, ReactNode } from 'react';
import { errorReporter } from '@/lib/errorReporter';
import { Button } from '@/components/ui/button';
interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  error?: Error;
}
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: undefined };
  }
  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    try {
      errorReporter.report({
        message: error.message,
        stack: error.stack || '',
        componentStack: errorInfo.componentStack,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        source: 'react-error-boundary',
        error: error,
        level: 'error',
      });
    } catch (reportError) {
      console.error('Failed to report error:', reportError);
    }
  }
  public render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="flex flex-col items-center justify-center min-h-screen p-8 text-center bg-background">
          <div className="max-w-md w-full bg-card p-8 rounded-2xl shadow-soft border border-destructive/20">
            <h2 className="text-2xl font-bold text-destructive-foreground font-display">
              Application Error
            </h2>
            <p className="mt-2 text-muted-foreground">
              Something went wrong. Please try refreshing the page.
            </p>
            {this.state.error && (
              <pre className="text-xs my-4 p-3 bg-destructive/10 text-destructive-foreground rounded-md text-left overflow-auto max-h-40">
                {this.state.error.message}
              </pre>
            )}
            <Button onClick={() => this.setState({ hasError: false, error: undefined })}>
              Try again
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
export { ErrorBoundary };