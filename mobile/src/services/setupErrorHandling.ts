import { crashReporter } from './crashReporting';

type ErrorHandler = (error: unknown, isFatal: boolean) => void;

// React Native's require runtime sets this global at startup — there's no value
// export for it from the `react-native` package, only a type, so it's accessed
// directly off `global` here.
declare const global: {
  ErrorUtils?: {
    getGlobalHandler(): ErrorHandler;
    setGlobalHandler(handler: ErrorHandler): void;
  };
};

export function setupGlobalErrorHandling() {
  const errorUtils = global.ErrorUtils;
  if (!errorUtils) return;

  const defaultHandler = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    crashReporter.recordError(error instanceof Error ? error : new Error(String(error)), {
      isFatal,
    });
    defaultHandler(error, isFatal);
  });
}
