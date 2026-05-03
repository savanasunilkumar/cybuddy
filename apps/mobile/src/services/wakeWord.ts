// Picovoice Porcupine Wake Word Detection
// Note: Requires a dev build to work - won't work in Expo Go

const PICOVOICE_ACCESS_KEY = 'dhu00TOr5O3evJadwGHQwIqoV6VhhcKnHKTziHQXQ8rfsD+fg1ERpg==';

// For custom "Hey CyPilot" wake word:
// 1. Go to https://console.picovoice.ai/
// 2. Create custom keyword "Hey CyPilot"
// 3. Download .ppn files for iOS/Android
// 4. Add to assets folder
// 5. Use PorcupineManager.fromKeywordPaths() instead

type WakeWordCallback = () => void;

class WakeWordService {
  private porcupineManager: any = null;
  private isListening: boolean = false;
  private onWakeWordDetected: WakeWordCallback | null = null;
  private initializationError: string | null = null;

  async initialize(callback: WakeWordCallback): Promise<void> {
    this.onWakeWordDetected = callback;

    try {
      // Dynamically import to avoid crash in Expo Go
      const {
        PorcupineManager,
        BuiltInKeywords,
        PorcupineErrors,
      } = await import('@picovoice/porcupine-react-native');

      if (!PorcupineManager) {
        throw new Error('Porcupine native module not available - requires dev build');
      }

      // Using "JARVIS" as placeholder until custom "Hey CyPilot" is created
      this.porcupineManager = await PorcupineManager.fromBuiltInKeywords(
        PICOVOICE_ACCESS_KEY,
        [BuiltInKeywords.JARVIS],
        (keywordIndex: number) => {
          console.log(`Wake word detected! Keyword index: ${keywordIndex}`);
          this.onWakeWordDetected?.();
        },
        (error: any) => {
          console.error('Porcupine error:', error?.message || error);
        },
        undefined, // model path
        undefined, // device
        [0.5] // sensitivities
      );

      console.log('Wake word service initialized with keyword: JARVIS');
    } catch (error: any) {
      this.initializationError = error?.message || 'Wake word requires dev build';
      console.log('Wake word not available:', this.initializationError);
      // Don't throw - just mark as unavailable
    }
  }

  async startListening(): Promise<void> {
    if (this.initializationError) {
      console.log('Wake word not available - tap button to use voice assistant');
      return;
    }

    if (!this.porcupineManager || this.isListening) {
      return;
    }

    try {
      await this.porcupineManager.start();
      this.isListening = true;
      console.log('Wake word listening started');
    } catch (error) {
      console.error('Failed to start listening:', error);
    }
  }

  async stopListening(): Promise<void> {
    if (!this.porcupineManager || !this.isListening) {
      return;
    }

    try {
      await this.porcupineManager.stop();
      this.isListening = false;
      console.log('Wake word listening stopped');
    } catch (error) {
      console.error('Failed to stop listening:', error);
    }
  }

  async cleanup(): Promise<void> {
    await this.stopListening();

    if (this.porcupineManager) {
      try {
        await this.porcupineManager.delete();
      } catch (e) {
        // Ignore cleanup errors
      }
      this.porcupineManager = null;
    }
  }

  getIsListening(): boolean {
    return this.isListening;
  }

  isAvailable(): boolean {
    return this.initializationError === null && this.porcupineManager !== null;
  }
}

export const wakeWordService = new WakeWordService();
