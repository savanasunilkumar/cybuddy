import axios from 'axios';
import { config } from '../config';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  maxTokens?: number;
  temperature?: number;
}

export interface ChatResult {
  content: string;
  reasoning?: string;
}

// Kimi K2.6 is a reasoning model — it spends tokens on internal chain-of-thought
// (returned in reasoning_content) BEFORE writing the visible content. If max_tokens
// is too low, the model finishes mid-reasoning and content comes back null.
// 2048 leaves comfortable room for thinking + a short voice-style reply.
const DEFAULT_MAX_TOKENS = 2048;
const DEFAULT_TEMPERATURE = 0.7;

const isAxiosLike = (err: unknown): err is { response?: { status?: number; data?: unknown }; message?: string } =>
  typeof err === 'object' && err !== null && 'message' in err;

const extractContent = (raw: any): ChatResult => {
  if (!raw || typeof raw !== 'object') {
    return { content: typeof raw === 'string' ? raw : '' };
  }

  if (typeof raw.response === 'string') {
    return { content: raw.response, reasoning: typeof raw.reasoning === 'string' ? raw.reasoning : undefined };
  }

  if (raw.result && typeof raw.result === 'object') {
    if (typeof raw.result.response === 'string') {
      return { content: raw.result.response, reasoning: typeof raw.result.reasoning === 'string' ? raw.result.reasoning : undefined };
    }
  }

  if (Array.isArray(raw.choices) && raw.choices.length > 0) {
    const choice = raw.choices[0];
    const message = choice?.message;
    if (message) {
      const reasoning =
        typeof message.reasoning === 'string'
          ? message.reasoning
          : typeof message.reasoning_content === 'string'
            ? message.reasoning_content
            : undefined;
      if (typeof message.content === 'string' && message.content.length > 0) {
        return { content: message.content, reasoning };
      }
      // Truncated mid-reasoning: surface the finish_reason so callers can react.
      if (choice.finish_reason === 'length') {
        return { content: '', reasoning };
      }
    }
  }

  return { content: '' };
};

// Describe an image with Kimi K2.6's vision capability. Used by the
// "describe what's around me" accessibility feature — caller passes a
// base64-encoded image (no data: prefix) plus the mime type, gets back a
// short spoken-style description.
export const describeImage = async (
  base64Image: string,
  mimeType: string = 'image/jpeg',
  prompt?: string
): Promise<string> => {
  if (!config.ai.proxyUrl || !config.ai.proxyToken) {
    throw new Error('AI proxy not configured (AI_PROXY_URL / AI_PROXY_TOKEN missing)');
  }

  const url = `${config.ai.proxyUrl.replace(/\/+$/, '')}/v1/ai/run/${config.ai.model}`;

  const userPrompt =
    prompt ||
    'You are describing this image out loud to a blind or low-vision Iowa State student. ' +
      'In 2 to 3 short sentences, describe what is in front of them — focus on what would help them act ' +
      '(people, signs, doors, traffic, food, screens, hazards, what they are holding). ' +
      'Read any clearly legible text aloud verbatim. ' +
      'Be direct and specific. Do not say "the image shows" — describe as if you are looking with them.';

  const messages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: userPrompt },
        {
          type: 'image_url',
          image_url: { url: `data:${mimeType};base64,${base64Image}` }
        }
      ]
    }
  ];

  try {
    const response = await axios.post(
      url,
      {
        messages,
        // Kimi K2.6 is a reasoning model — vision queries spend a *lot* of
        // tokens on internal chain-of-thought before writing the visible
        // description. 1024 was too tight for real photos. 4096 leaves
        // generous headroom; the actual spoken reply is still 2-3 sentences
        // because the system prompt enforces it.
        max_tokens: 4096,
        temperature: 0.4,
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${config.ai.proxyToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    const result = extractContent(response.data);
    if (!result.content) {
      throw new Error(`Empty description from model. Raw: ${JSON.stringify(response.data).slice(0, 300)}`);
    }
    return result.content;
  } catch (err) {
    if (isAxiosLike(err)) {
      const status = err.response?.status;
      const detail = err.response?.data ? JSON.stringify(err.response.data).slice(0, 300) : err.message;
      throw new Error(`Cloudflare vision error${status ? ` (${status})` : ''}: ${detail}`);
    }
    throw err;
  }
};

// Synthesize speech via Cloudflare's @cf/myshell-ai/melotts model. Returns
// base64-encoded MP3 audio that the mobile client can play through a
// data:audio/mpeg;base64,... URI — same shape elevenLabsService used.
export const tts = async (text: string, lang: string = 'en'): Promise<string> => {
  if (!config.ai.proxyUrl || !config.ai.proxyToken) {
    throw new Error('AI proxy not configured (AI_PROXY_URL / AI_PROXY_TOKEN missing)');
  }

  const url = `${config.ai.proxyUrl.replace(/\/+$/, '')}/v1/ai/run/@cf/myshell-ai/melotts`;

  try {
    const response = await axios.post(
      url,
      { prompt: text, lang },
      {
        headers: {
          'Authorization': `Bearer ${config.ai.proxyToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000,
        // melotts returns JSON ({ audio: base64 }) or raw binary depending on
        // routing — accept both.
        responseType: 'arraybuffer'
      }
    );

    const contentType = (response.headers?.['content-type'] || '').toString();
    if (contentType.includes('application/json')) {
      const json = JSON.parse(Buffer.from(response.data).toString('utf-8'));
      const audio = json?.audio || json?.result?.audio;
      if (typeof audio !== 'string' || audio.length === 0) {
        throw new Error(`melotts returned JSON without audio field: ${JSON.stringify(json).slice(0, 200)}`);
      }
      return audio;
    }

    // Binary (octet-stream) — base64-encode for transport to mobile.
    return Buffer.from(response.data).toString('base64');
  } catch (err) {
    if (isAxiosLike(err)) {
      const status = err.response?.status;
      const detailRaw = err.response?.data;
      let detail = err.message ?? '';
      if (detailRaw) {
        try {
          detail = Buffer.isBuffer(detailRaw) || detailRaw instanceof Uint8Array
            ? Buffer.from(detailRaw as any).toString('utf-8').slice(0, 300)
            : JSON.stringify(detailRaw).slice(0, 300);
        } catch {
          /* ignore */
        }
      }
      throw new Error(`Cloudflare TTS error${status ? ` (${status})` : ''}: ${detail}`);
    }
    throw err;
  }
};

export const chat = async (messages: ChatMessage[], opts: ChatOptions = {}): Promise<ChatResult> => {
  if (!config.ai.proxyUrl || !config.ai.proxyToken) {
    throw new Error('AI proxy not configured (AI_PROXY_URL / AI_PROXY_TOKEN missing)');
  }

  const url = `${config.ai.proxyUrl.replace(/\/+$/, '')}/v1/ai/run/${config.ai.model}`;

  try {
    const response = await axios.post(
      url,
      {
        messages,
        max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
        temperature: opts.temperature ?? DEFAULT_TEMPERATURE,
        stream: false
      },
      {
        headers: {
          'Authorization': `Bearer ${config.ai.proxyToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const result = extractContent(response.data);
    if (!result.content) {
      throw new Error(`Empty response from model. Raw: ${JSON.stringify(response.data).slice(0, 300)}`);
    }
    return result;
  } catch (err) {
    if (isAxiosLike(err)) {
      const status = err.response?.status;
      const detail = err.response?.data ? JSON.stringify(err.response.data).slice(0, 300) : err.message;
      throw new Error(`Cloudflare AI proxy error${status ? ` (${status})` : ''}: ${detail}`);
    }
    throw err;
  }
};
