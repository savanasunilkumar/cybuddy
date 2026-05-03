import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { wakeWordService } from '../services/wakeWord';

// Navigation ref will be set by NavigationContainer
let navigationRef: any = null;

export const setNavigationRef = (ref: any) => {
  navigationRef = ref;
};

interface VoiceContextType {
  openVoiceAssistant: () => void;
  isWakeWordActive: boolean;
  startWakeWordListener: () => Promise<void>;
  stopWakeWordListener: () => Promise<void>;
  wakeWordError: string | null;
}

const VoiceContext = createContext<VoiceContextType>({
  openVoiceAssistant: () => {},
  isWakeWordActive: false,
  startWakeWordListener: async () => {},
  stopWakeWordListener: async () => {},
  wakeWordError: null,
});

export const useVoiceNavigation = () => useContext(VoiceContext);

interface VoiceProviderProps {
  children: React.ReactNode;
}

export const VoiceProvider: React.FC<VoiceProviderProps> = ({ children }) => {
  const [isWakeWordActive, setIsWakeWordActive] = useState(false);
  const [wakeWordError, setWakeWordError] = useState<string | null>(null);
  const wakeWordInitialized = useRef(false);

  const openVoiceAssistant = useCallback(() => {
    if (navigationRef?.current) {
      navigationRef.current.navigate('VoiceAssistant');
    }
  }, []);

  const startWakeWordListener = useCallback(async () => {
    try {
      setWakeWordError(null);

      if (!wakeWordInitialized.current) {
        await wakeWordService.initialize(openVoiceAssistant);
        wakeWordInitialized.current = true;
      }

      await wakeWordService.startListening();

      // Check if wake word is actually available
      if (wakeWordService.isAvailable()) {
        setIsWakeWordActive(true);
        console.log('Wake word listener started - say "Jarvis"');
      } else {
        // Wake word not available (Expo Go) - silently fail
        console.log('Wake word not available in Expo Go - use button instead');
        setIsWakeWordActive(false);
      }
    } catch (error: any) {
      console.log('Wake word setup skipped:', error?.message || 'requires dev build');
      setIsWakeWordActive(false);
    }
  }, [openVoiceAssistant]);

  const stopWakeWordListener = useCallback(async () => {
    try {
      await wakeWordService.stopListening();
      setIsWakeWordActive(false);
    } catch (error) {
      console.error('Failed to stop wake word listener:', error);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wakeWordService.cleanup();
    };
  }, []);

  return (
    <VoiceContext.Provider
      value={{
        openVoiceAssistant,
        isWakeWordActive,
        startWakeWordListener,
        stopWakeWordListener,
        wakeWordError,
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
};
