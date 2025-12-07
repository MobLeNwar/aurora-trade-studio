import React, { Component, ErrorInfo, ReactNode } from 'react';
import { errorReporter } from '@/lib/errorReporter';
import { ErrorFallback } from './ErrorFallback';
interface Props {
  children: ReactNode;
  fallbackRender?: (props: { error: Error | null }) => ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
}
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
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
      if (this.props.fallbackRender) {
        return this.props.fallbackRender({ error: this.state.error });
      }
      return (
        <ErrorFallback
          title="Application Error"
          message="Something went wrong. Please try refreshing the page."
          error={this.state.error}
        />
      );
    }
    return this.props.children;
  }
}