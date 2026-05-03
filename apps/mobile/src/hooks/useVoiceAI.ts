import { useState, useRef, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';
import { groqService } from '../services/groq';
import { cloudflareTTSService as ttsService } from '../services/cloudflareTTS';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'error';

interface UseVoiceAIReturn {
  state: VoiceState;
  transcript: string;
  response: string;
  error: string | null;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  cancel: () => Promise<void>;
}

export const useVoiceAI = (): UseVoiceAIReturn => {
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const isCancelledRef = useRef(false);

  // Configure audio on mount
  useEffect(() => {
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
        });
      } catch (err) {
        console.error('Error setting up audio:', err);
      }
    };

    setupAudio();

    return () => {
      // Cleanup on unmount
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  const startListening = useCallback(async () => {
    try {
      setError(null);
      setTranscript('');
      setResponse('');
      isCancelledRef.current = false;

      // Request permissions
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setError('Microphone permission required');
        setState('error');
        return;
      }

      // Configure for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Start recording
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      setState('listening');
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to start recording');
      setState('error');
    }
  }, []);

  const stopListening = useCallback(async () => {
    if (!recordingRef.current || isCancelledRef.current) {
      setState('idle');
      return;
    }

    try {
      setState('processing');

      // Stop recording
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri || isCancelledRef.current) {
        setState('idle');
        return;
      }

      // Configure for playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Transcribe audio
      const transcribedText = await groqService.transcribeAudio(uri);

      if (isCancelledRef.current) {
        setState('idle');
        return;
      }

      if (!transcribedText || transcribedText.length < 2) {
        setError("I didn't catch that. Try again?");
        setState('idle');
        return;
      }

      setTranscript(transcribedText);

      // Get AI response
      const aiResponse = await groqService.chat(transcribedText);

      if (isCancelledRef.current) {
        setState('idle');
        return;
      }

      setResponse(aiResponse);
      setState('speaking');

      // Speak the response using native TTS
      try {
        await ttsService.speak(aiResponse);
      } catch (speakError) {
        console.error('TTS error:', speakError);
        // Even if TTS fails, we still have the response
      }

      setState('idle');
    } catch (err) {
      console.error('Error processing voice:', err);
      setError('Something went wrong. Try again?');
      setState('error');

      // Auto-recover to idle after a moment
      setTimeout(() => {
        if (state === 'error') {
          setState('idle');
        }
      }, 2000);
    }
  }, [state]);

  const cancel = useCallback(async () => {
    isCancelledRef.current = true;

    // Stop recording if active
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch (err) {
        // Ignore
      }
      recordingRef.current = null;
    }

    // Stop any playing TTS
    try {
      await ttsService.stop();
    } catch (err) {
      // Ignore
    }

    setState('idle');
    setError(null);
  }, []);

  return {
    state,
    transcript,
    response,
    error,
    startListening,
    stopListening,
    cancel,
  };
};
