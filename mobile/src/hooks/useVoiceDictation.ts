import { useCallback, useEffect, useRef, useState } from 'react';
import Voice, { SpeechErrorEvent, SpeechResultsEvent } from '@react-native-voice/voice';

/**
 * On-device speech-to-text (SFSpeechRecognizer under the hood, via
 * @react-native-voice/voice) for hands-free note dictation mid-service — see
 * ChairsideModeScreen's mic button. No audio ever leaves the device; this is not an
 * OpenAI call.
 */
export function useVoiceDictation() {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Voice's event setters are assigned once and must not be re-assigned per render —
  // this ref lets the stable callbacks below always read the latest state setters.
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    Voice.onSpeechStart = () => {
      if (mountedRef.current) setListening(true);
    };
    Voice.onSpeechEnd = () => {
      if (mountedRef.current) setListening(false);
    };
    Voice.onSpeechError = (e: SpeechErrorEvent) => {
      if (!mountedRef.current) return;
      setListening(false);
      // iOS's SFSpeechRecognizer fires a benign trailing error (kAFAssistantErrorDomain
      // code 203, message "Retry") after it has already delivered final results and the
      // session ends normally — confirmed live in the Simulator, where a successful
      // transcript ("Play every") was immediately followed by this exact code/message.
      // Not a real failure, so it must not surface as one.
      if (e.error?.code === '203') return;
      setError(e.error?.message ?? 'Speech recognition failed');
    };
    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      if (mountedRef.current) setTranscript(e.value?.[0] ?? '');
    };
    Voice.onSpeechPartialResults = (e: SpeechResultsEvent) => {
      if (mountedRef.current) setTranscript(e.value?.[0] ?? '');
    };

    return () => {
      mountedRef.current = false;
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setTranscript('');
    try {
      await Voice.start('en-US');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start dictation');
    }
  }, []);

  const stop = useCallback(async () => {
    try {
      await Voice.stop();
    } catch {
      // Best-effort — if the recognizer already stopped itself, this is a no-op.
    }
  }, []);

  const reset = useCallback(() => {
    setTranscript('');
    setError(null);
  }, []);

  return { listening, transcript, error, start, stop, reset };
}
