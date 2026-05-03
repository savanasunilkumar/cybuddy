import axios from 'axios';
import { apiService } from './api';

// Groq is still used for Whisper transcription (mobile -> Groq direct).
// Chat now goes through the Cypilot backend, which calls Kimi K2.6 on
// Cloudflare Workers AI via the originx-ai-proxy worker.
//
// TODO (post-hackathon): move transcription behind the backend too so this
// key isn't shipped in the mobile bundle.
// Set EXPO_PUBLIC_GROQ_API_KEY in apps/mobile/.env (gitignored).
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';
const GROQ_WHISPER_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatPayload {
  response: string;
  reasoning?: string;
}

class GroqService {
  private conversationHistory: ChatMessage[] = [];

  resetConversation() {
    this.conversationHistory = [];
  }

  async chat(userMessage: string): Promise<string> {
    try {
      const data = await apiService.post<ChatPayload>(
        '/api/voice/chat',
        {
          message: userMessage,
          history: this.conversationHistory,
        },
        { timeout: 45000 } // Kimi K2.6 reasoning + 4-source live-context fetch
      );

      if (!data?.response) {
        console.error('Backend voice chat returned empty response');
        return "Sorry, I couldn't get an answer. Try again in a sec?";
      }

      this.conversationHistory.push({ role: 'user', content: userMessage });
      this.conversationHistory.push({ role: 'assistant', content: data.response });

      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }

      return data.response;
    } catch (error) {
      console.error('Voice chat error:', error);

      if (axios.isAxiosError(error)) {
        console.error('Voice chat error details:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });

        if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
          return "I can't reach my brain right now. Check that the backend is running.";
        }
        if (error.response?.status === 401 || error.response?.status === 403) {
          return "I can't see your data — try logging in again.";
        }
        if (error.response?.status === 502) {
          return "I'm having trouble thinking right now. Mind trying again?";
        }
      }

      return "Sorry, I had trouble understanding. Can you say that again?";
    }
  }

  async quickChat(userMessage: string): Promise<string> {
    try {
      const data = await apiService.post<ChatPayload>(
        '/api/voice/chat',
        {
          message: userMessage,
          history: [],
        },
        { timeout: 45000 }
      );
      return data?.response || "Sorry, I couldn't catch that.";
    } catch (error) {
      console.error('Voice quick chat error:', error);
      return "Sorry, can you repeat that?";
    }
  }

  // Transcribe audio using Groq's Whisper. Stays direct-to-Groq for now —
  // multipart audio uploads are awkward to proxy and Whisper transcription
  // doesn't carry the same data-leakage risk as a chat key.
  async transcribeAudio(audioUri: string): Promise<string> {
    try {
      const formData = new FormData();

      const filename = audioUri.split('/').pop() || 'audio.m4a';
      const extension = filename.split('.').pop()?.toLowerCase();

      let mimeType = 'audio/m4a';
      if (extension === '3gp') mimeType = 'audio/3gpp';
      else if (extension === 'wav') mimeType = 'audio/wav';
      else if (extension === 'mp3') mimeType = 'audio/mpeg';
      else if (extension === 'webm') mimeType = 'audio/webm';

      formData.append('file', {
        uri: audioUri,
        type: mimeType,
        name: filename,
      } as any);

      formData.append('model', 'whisper-large-v3-turbo');
      formData.append('response_format', 'text');
      formData.append('language', 'en');

      console.log('Transcribing audio:', { uri: audioUri, mimeType, filename });

      const response = await fetch(GROQ_WHISPER_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Whisper API error:', response.status, errorText);

        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.error?.message || `Whisper API error: ${response.status}`);
        } catch {
          throw new Error(`Whisper API error: ${response.status}`);
        }
      }

      const transcription = await response.text();
      console.log('Transcription result:', transcription);
      return transcription.trim();
    } catch (error) {
      console.error('Transcription error:', error);
      throw error;
    }
  }
}

export const groqService = new GroqService();
