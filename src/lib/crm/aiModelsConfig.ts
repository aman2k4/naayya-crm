// Centralized AI model configuration for cold email generation
// All models are accessed via OpenRouter

export interface AIModel {
  id: string;
  name: string;
  modelId: string; // OpenRouter model identifier
}

export const AI_MODELS: AIModel[] = [
  { id: 'chatgpt-4o', name: 'ChatGPT-4o', modelId: 'openai/chatgpt-4o-latest' },
  { id: 'gemini-3-pro', name: 'Gemini 3 Pro', modelId: 'google/gemini-3-pro-preview' },
  { id: 'gemini-3-flash', name: 'Gemini 3 Flash', modelId: 'google/gemini-3-flash-preview' },
  { id: 'claude-opus', name: 'Claude Opus 4.5', modelId: 'anthropic/claude-opus-4.5' },
  { id: 'kimi-k2', name: 'Kimi K2', modelId: 'moonshotai/kimi-k2' },
];
