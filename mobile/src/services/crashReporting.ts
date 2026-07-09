export interface CrashReporter {
  recordError(error: Error, context?: Record<string, unknown>): void;
  log(message: string): void;
}

const consoleCrashReporter: CrashReporter = {
  recordError(error, context) {
    console.error('[crashReporting] error captured:', error, context ?? {});
  },
  log(message) {
    console.log('[crashReporting]', message);
  },
};

/**
 * Console-based today. Swap for a real @react-native-firebase/crashlytics-backed
 * implementation once a real Firebase project exists with a GoogleService-Info.plist
 * (iOS) / google-services.json (Android) — see docs/roadmap.md Phase 2 for why that
 * native SDK isn't wired in yet and the exact activation steps.
 */
export const crashReporter: CrashReporter = consoleCrashReporter;
