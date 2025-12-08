import { useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { useEffect, useMemo } from 'react';
import { errorReporter } from '@/lib/errorReporter';
import { ErrorFallback } from './ErrorFallback';
export function RouteErrorBoundary() {
  // Call the hook unconditionally, but guard for runtimes where a data router is not present.
  // useRouteError may throw when not used within a data router — catch that and fall back.
  let routeError: unknown;
  let routeHookAvailable = true;
  try {
    routeError = useRouteError();
  } catch (e) {
    // Router not present (older router/runtime). Fall back to generic behavior.
    routeHookAvailable = false;
    routeError = undefined;
  }

  useEffect(() => {
    if (!routeHookAvailable || !routeError) return;
    let errorMessage = 'Unknown route error';
    let errorStack = '';
    if (isRouteErrorResponse(routeError)) {
      errorMessage = `Route Error ${routeError.status}: ${routeError.statusText}`;
      if ((routeError as any).data) errorMessage += ` - ${JSON.stringify((routeError as any).data)}`;
    } else if (routeError instanceof Error) {
      errorMessage = routeError.message;
      errorStack = routeError.stack || '';
    } else if (typeof routeError === 'string') {
      errorMessage = routeError;
    } else {
      errorMessage = JSON.stringify(routeError);
    }
    errorReporter.report({
      message: errorMessage,
      stack: errorStack,
      url: window.location.href,
      timestamp: new Date().toISOString(),
      source: 'react-router',
      error: routeError,
      level: "error",
    });
  }, [routeHookAvailable, routeError]);

  const errorTitle = useMemo(() => {
    if (!routeHookAvailable) return "Unexpected Error";
    if (isRouteErrorResponse(routeError)) {
      if ((routeError as any).status === 404) return "Page Not Found";
      return `${(routeError as any).status} ${(routeError as any).statusText}`;
    }
    return "Unexpected Error";
  }, [routeHookAvailable, routeError]);

  const errorMessage = useMemo(() => {
    if (!routeHookAvailable) return "An unexpected error occurred. Please try again later.";
    if (isRouteErrorResponse(routeError)) {
      if ((routeError as any).status === 404) return "The page you are looking for does not exist.";
      return "Sorry, an error occurred while loading this page.";
    }
    return "An unexpected error occurred. Please try again later.";
  }, [routeHookAvailable, routeError]);

  // If the data router hook is not available, show a generic fallback UI instead of "Loading..."
  if (!routeHookAvailable) {
    return (
      <ErrorFallback
        title={errorTitle}
        message={errorMessage}
        error={undefined}
        statusMessage="Navigation error detected"
      />
    );
  }

  if (!routeError) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }

  return (
    <ErrorFallback
      title={errorTitle}
      message={errorMessage}
      error={routeError}
      statusMessage="Navigation error detected"
    />
  );
}