import crashlytics from '@react-native-firebase/crashlytics';

export interface CrashReporter {
  recordError(error: Error, context?: Record<string, unknown>): void;
  log(message: string): void;
}

/**
 * Backed by Firebase Crashlytics (iOS — GoogleService-Info.plist +
 * FirebaseApp.configure() in AppDelegate.swift). Android needs its own
 * google-services.json + Gradle plugin before this works there too, per the app's
 * iOS-first rollout.
 */
const crashlyticsReporter: CrashReporter = {
  recordError(error, context) {
    console.error('[crashReporting] error captured:', error, context ?? {});
    if (context) {
      crashlytics().log(`context: ${JSON.stringify(context)}`);
    }
    crashlytics().recordError(error);
  },
  log(message) {
    console.log('[crashReporting]', message);
    crashlytics().log(message);
  },
};

export const crashReporter: CrashReporter = crashlyticsReporter;
