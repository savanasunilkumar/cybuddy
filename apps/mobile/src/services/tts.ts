import * as Speech from 'expo-speech';

// TTS Service using expo-speech (free, built-in)
// Falls back to device's native TTS engine

interface TTSOptions {
  language?: string;
  pitch?: number;
  rate?: number;
  voice?: string;
}

class TTSService {
  private isSpeaking: boolean = false;
  private defaultOptions: TTSOptions = {
    language: 'en-US',
    pitch: 1.0,
    rate: 0.95, // Slightly slower for clarity
  };

  async speak(text: string, options?: TTSOptions): Promise<void> {
    // Stop any current speech
    await this.stop();

    return new Promise((resolve, reject) => {
      this.isSpeaking = true;

      Speech.speak(text, {
        ...this.defaultOptions,
        ...options,
        onDone: () => {
          this.isSpeaking = false;
          resolve();
        },
        onError: (error) => {
          this.isSpeaking = false;
          console.error('TTS error:', error);
          reject(error);
        },
        onStopped: () => {
          this.isSpeaking = false;
          resolve();
        },
      });
    });
  }

  async stop(): Promise<void> {
    if (this.isSpeaking) {
      await Speech.stop();
      this.isSpeaking = false;
    }
  }

  async getAvailableVoices(): Promise<Speech.Voice[]> {
    try {
      return await Speech.getAvailableVoicesAsync();
    } catch (error) {
      console.error('Error getting voices:', error);
      return [];
    }
  }

  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }
}

export const ttsService = new TTSService();
