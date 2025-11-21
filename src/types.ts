// =========================================
// Base Chat Message
// =========================================
export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

// =========================================
// Provider Response Format
// =========================================
export interface AIResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// =========================================
// Provider Configuration
// =========================================
export interface AIProviderConfig {
  apiKey: string; // For Claude & OpenAI, ignored for Ollama
  model: string; // Model name to run
  maxTokens: number; // Max response tokens
  temperature: number; // Sampling temperature
}

// =========================================
// Base Provider Contract
// =========================================
export interface IAIProvider {
  sendMessage(
    messages: AIMessage[],
    config: AIProviderConfig
  ): Promise<AIResponse>;

  streamMessage?(
    messages: AIMessage[],
    config: AIProviderConfig,
    onChunk: (chunk: string) => void
  ): Promise<AIResponse>;
}

// =========================================
// Provider Types Supported by Code Cook
// =========================================
export type ProviderType = "claude" | "openai" | "ollama";
