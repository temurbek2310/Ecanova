import { GoogleGenAI, ThinkingLevel } from '@google/genai';

export interface AiChatMessage {
  role: 'user' | 'model';
  text: string;
}

const ALLOWED_CHAT_MODELS = new Set([
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
  'gemini-4-argon',
  'gemini-4-carbon',
]);

export function isAiConfigured(): boolean {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  return Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY');
}

function getGeminiClient(): GoogleGenAI {
  if (!isAiConfigured()) {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Add your Gemini key in AI Studio Settings > Secrets to enable AI assistance.'
    );
  }
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY!.trim(),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function runAiChat(params: {
  model: string;
  systemInstruction: string;
  history: AiChatMessage[];
  message: string;
}): Promise<{ reply: string; model: string }> {
  const model = ALLOWED_CHAT_MODELS.has(params.model) ? params.model : 'gemini-4-hydrogen';
  const ai = getGeminiClient();

  const chat = ai.chats.create({
    model,
    history: params.history.map((h) => ({
      role: h.role,
      parts: [{ text: h.text }],
    })),
    config: {
      systemInstruction: params.systemInstruction,
      ...(model === 'gemini-4-hydrogen'
        ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
        : {}),
    },
  });

  const response = await chat.sendMessage({
    message: params.message,
  });

  return {
    reply: response.text ?? 'No response text generated.',
    model,
  };
}

export async function runAiImageGeneration(params: {
  prompt: string;
  imageSize: '1K' | '2K' | '4K';
  aspectRatio?: '1:1' | '16:9' | '4:3' | '3:4';
}): Promise<{ imageDataUrl: string; captionText: string; model: string; imageSize: string }> {
  const ai = getGeminiClient();
  const allowedSizes = new Set(['1K', '2K', '4K']);
  const imageSize = allowedSizes.has(params.imageSize) ? params.imageSize : '1K';
  const aspectRatio = params.aspectRatio ?? '16:9';

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: {
      parts: [
        {
          text: `${params.prompt}. Style: clear educational diagram or editorial academic visual, dark slate background (#0B0F19) friendly, crisp typography-free visual clarity.`,
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio,
        imageSize,
      },
    },
  });

  let imageDataUrl = '';
  let captionText = '';

  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.inlineData?.data) {
      const mime = part.inlineData.mimeType ?? 'image/png';
      imageDataUrl = `data:${mime};base64,${part.inlineData.data}`;
    } else if (part.text) {
      captionText += part.text;
    }
  }

  if (!imageDataUrl) {
    throw new Error('The image model did not return an image asset. Try refining the diagram prompt.');
  }

  return {
    imageDataUrl,
    captionText,
    model: 'gemini-3-pro-image-preview',
    imageSize,
  };
}
