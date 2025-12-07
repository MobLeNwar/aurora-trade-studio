import { useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { errorReporter } from '@/lib/errorReporter';
import { ErrorFallback } from './ErrorFallback';
export function RouteErrorBoundary() {
  const error = useRouteError();
  useEffect(() => {
    if (!error) return;
    let errorMessage = 'Unknown route error';
    let errorStack = '';
    if (isRouteErrorResponse(error)) {
      errorMessage = `Route Error ${error.status}: ${error.statusText}`;
      if (error.data) errorMessage += ` - ${JSON.stringify(error.data)}`;
    } else if (error instanceof Error) {
      errorMessage = error.message;
      errorStack = error.stack || '';
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else {
      errorMessage = JSON.stringify(error);
    }
    errorReporter.report({
      message: errorMessage,
      stack: errorStack,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      source: 'react-router',
      error: error,
      level: "error",
    });
  }, [error]);
  const errorTitle = useMemo(() => {
    if (isRouteErrorResponse(error)) {
      if (error.status === 404) return "Page Not Found";
      return `${error.status} ${error.statusText}`;
    }
    return "Unexpected Error";
  }, [error]);
  const errorMessage = useMemo(() => {
    if (isRouteErrorResponse(error)) {
      if (error.status === 404) return "The page you are looking for does not exist.";
      return "Sorry, an error occurred while loading this page.";
    }
    return "An unexpected error occurred. Please try again later.";
  }, [error]);
  if (!error) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }
  return (
    <ErrorFallback
      title={errorTitle}
      message={errorMessage}
      error={error}
      statusMessage="Navigation error detected"
    />
  );
}