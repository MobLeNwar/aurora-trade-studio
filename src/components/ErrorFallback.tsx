import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { errorReporter } from '@/lib/errorReporter';
interface ErrorFallbackProps {
  title?: string;
  message?: string;
  error?: unknown;
  statusMessage?: string;
  onRetry?: () => void;
  onGoHome?: () => void;
}
export function ErrorFallback({ title, message, error, statusMessage, onRetry, onGoHome }: ErrorFallbackProps) {
  useEffect(() => {
    if (error && error instanceof Error) {
      errorReporter.report({
        message: error.message,
        stack: error.stack || '',
        url: window.location.href,
        timestamp: new Date().toISOString(),
        error: error,
        level: 'error',
      });
    }
  }, [error]);
  return (
    <div role="alert" className="flex items-center justify-center min-h-screen p-8 text-center bg-background">
      <div className="max-w-md w-full bg-card p-8 rounded-2xl shadow-soft border border-destructive/20">
        <h2 className="text-2xl font-bold text-destructive-foreground font-display">
          {title || 'An Error Occurred'}
        </h2>
        <p className="mt-2 text-muted-foreground">
          {statusMessage || message || 'Please try again.'}
        </p>
        {error instanceof Error && (
          <pre className="text-xs my-4 p-3 bg-destructive/10 text-destructive-foreground rounded-md text-left overflow-auto max-h-40">
            {error.message}
          </pre>
        )}
        <div className="mt-4 flex justify-center gap-2">
          <Button onClick={() => (onRetry ? onRetry() : window.location.reload())}>
            Retry
          </Button>
          {onGoHome && (
            <Button onClick={onGoHome}>
              Go Home
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}