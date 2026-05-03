import { Audio } from 'expo-av';
import { apiService } from './api';

// TTS via Cypilot backend → originx-ai-proxy worker → Cloudflare Workers AI
// (@cf/myshell-ai/melotts). Returns WAV audio base64-encoded; mobile plays
// via expo-av from a data URI.
//
// Same `.speak(text)` / `.stop()` interface as elevenLabsService so it's a
// drop-in replacement.

interface TTSResponse {
  audio: string;
  mimeType?: string;
}

class CloudflareTTSService {
  private sound: Audio.Sound | null = null;

  async speak(text: string): Promise<void> {
    try {
      await this.stop();

      const data = await apiService.post<TTSResponse>('/api/voice/tts', { text });

      if (!data?.audio) {
        throw new Error('Empty audio payload from TTS endpoint');
      }

      const mime = data.mimeType || 'audio/wav';

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:${mime};base64,${data.audio}` },
        { shouldPlay: true }
      );

      this.sound = sound;

      return new Promise((resolve) => {
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            this.cleanup();
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('Cloudflare TTS speak error:', error);
      this.cleanup();
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.sound) {
      try {
        await this.sound.stopAsync();
      } catch {
        /* ignore */
      }
      await this.cleanup();
    }
  }

  private async cleanup(): Promise<void> {
    if (this.sound) {
      try {
        await this.sound.unloadAsync();
      } catch {
        /* ignore */
      }
      this.sound = null;
    }
  }
}

export const cloudflareTTSService = new CloudflareTTSService();
