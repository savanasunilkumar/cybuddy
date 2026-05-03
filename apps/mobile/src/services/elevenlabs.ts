import { Audio } from 'expo-av';

// Set EXPO_PUBLIC_ELEVENLABS_API_KEY in apps/mobile/.env (gitignored) if you
// switch back from cloudflareTTSService to elevenLabsService.
const ELEVENLABS_API_KEY = process.env.EXPO_PUBLIC_ELEVENLABS_API_KEY || '';
const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';

// Voice IDs - ElevenLabs pre-made voices
const VOICES = {
  rachel: '21m00Tcm4TlvDq8ikWAM', // Calm, young female
  adam: 'pNInz6obpgDQGcFmaJgB', // Deep, male
  bella: 'EXAVITQu4vr4xnSDxMaL', // Soft, female
  josh: 'TxGEqnHWrfWFTfGW9XjX', // Young, male - friendly
  elli: 'MF3mGyEYCl7XYWbV9V6O', // Young, female - energetic
};

// Default voice for Cy — Rachel (calm, young female, assistant-like)
const DEFAULT_VOICE_ID = VOICES.rachel;

interface VoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  use_speaker_boost?: boolean;
}

class ElevenLabsService {
  private sound: Audio.Sound | null = null;
  private defaultSettings: VoiceSettings = {
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0.5,
    use_speaker_boost: true,
  };

  async speak(text: string, voiceId: string = DEFAULT_VOICE_ID): Promise<void> {
    try {
      // Stop any currently playing audio
      await this.stop();

      // Request audio from ElevenLabs
      const response = await fetch(
        `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`,
        {
          method: 'POST',
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': ELEVENLABS_API_KEY,
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_turbo_v2_5', // Fastest model
            voice_settings: this.defaultSettings,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('ElevenLabs API error:', error);
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      // Get audio blob
      const audioBlob = await response.blob();

      // Convert blob to base64
      const reader = new FileReader();
      const base64Audio = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const base64 = reader.result as string;
          // Remove data URL prefix
          const base64Data = base64.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(audioBlob);
      });

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Create and play sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:audio/mpeg;base64,${base64Audio}` },
        { shouldPlay: true }
      );

      this.sound = sound;

      // Wait for playback to complete
      return new Promise((resolve) => {
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            this.cleanup();
            resolve();
          }
        });
      });
    } catch (error) {
      console.error('ElevenLabs speak error:', error);
      this.cleanup();
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (this.sound) {
      try {
        await this.sound.stopAsync();
        await this.cleanup();
      } catch (error) {
        console.error('Error stopping audio:', error);
      }
    }
  }

  private async cleanup(): Promise<void> {
    if (this.sound) {
      try {
        await this.sound.unloadAsync();
      } catch (error) {
        // Ignore cleanup errors
      }
      this.sound = null;
    }
  }

  // Get available voices
  async getVoices(): Promise<Array<{ voice_id: string; name: string }>> {
    try {
      const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch voices');
      }

      const data = await response.json();
      return data.voices || [];
    } catch (error) {
      console.error('Error fetching voices:', error);
      return [];
    }
  }
}

export const elevenLabsService = new ElevenLabsService();
