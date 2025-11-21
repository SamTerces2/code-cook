// src/aiService.ts
import * as vscode from "vscode";

import { ClaudeProvider } from "./providers/claudeProvider";
import { OpenAIProvider } from "./providers/openaiProvider";
import { OllamaProvider } from "./providers/ollamaProvider";

import {
  AIMessage,
  AIProviderConfig,
  AIResponse,
  IAIProvider,
  ProviderType,
} from "./types";

export class AIService {
  private claudeProvider: ClaudeProvider;
  private openaiProvider: OpenAIProvider;
  private ollamaProvider: OllamaProvider;

  private currentProvider: ProviderType;

  constructor() {
    this.claudeProvider = new ClaudeProvider();
    this.openaiProvider = new OpenAIProvider();
    this.ollamaProvider = new OllamaProvider();

    this.currentProvider = this.getDefaultProvider();
  }

  // ================================
  // CONFIGURATION HELPERS
  // ================================
  private getConfig(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration("claudeCook");
  }

  private getDefaultProvider(): ProviderType {
    return this.getConfig().get("defaultProvider", "claude") as ProviderType;
  }

  public getCurrentProvider(): ProviderType {
    return this.currentProvider;
  }

  public setProvider(provider: ProviderType) {
    this.currentProvider = provider;
  }

  // ================================
  // PROVIDER CONFIG
  // ================================
  private getProviderConfig(provider: ProviderType): AIProviderConfig {
    const cfg = this.getConfig();

    // Anthropic - Claude
    if (provider === "claude") {
      return {
        apiKey: cfg.get("anthropicApiKey", ""),
        model: cfg.get("claudeModel", "claude-sonnet-4-20250514"),
        maxTokens: cfg.get("maxTokens", 4000),
        temperature: cfg.get("temperature", 0.7),
      };
    }

    // OpenAI - ChatGPT
    if (provider === "openai") {
      return {
        apiKey: cfg.get("openaiApiKey", ""),
        model: cfg.get("openaiModel", "gpt-4-turbo-preview"),
        maxTokens: cfg.get("maxTokens", 4000),
        temperature: cfg.get("temperature", 0.7),
      };
    }

    // Ollama - Local LLM (no API key required)
    return {
      apiKey: "local",
      model: cfg.get("ollamaModel", "llama3.1"),
      maxTokens: cfg.get("maxTokens", 4000),
      temperature: cfg.get("temperature", 0.7),
    };
  }

  private validateConfig(config: AIProviderConfig, provider: ProviderType) {
    if (provider === "ollama") return; // Ollama has no API key

    if (!config.apiKey) {
      throw new Error(
        provider === "claude"
          ? "Anthropic API key not configured. Run 'Code Cook: Configure API Keys'."
          : "OpenAI API key not configured. Run 'Code Cook: Configure API Keys'."
      );
    }
  }

  // ================================
  // GET PROVIDER INSTANCE
  // ================================
  private getProvider(provider: ProviderType): IAIProvider {
    if (provider === "claude") return this.claudeProvider;
    if (provider === "openai") return this.openaiProvider;
    return this.ollamaProvider;
  }

  // ================================
  // SEND MESSAGE (NON-STREAM)
  // ================================
  public async sendMessage(
    messages: AIMessage[],
    provider?: ProviderType
  ): Promise<AIResponse> {
    const p = provider || this.currentProvider;

    const cfg = this.getProviderConfig(p);
    this.validateConfig(cfg, p);

    return this.getProvider(p).sendMessage(messages, cfg);
  }

  // ================================
  // STREAMING MESSAGE (REAL-TIME)
  // ================================
  public async streamMessage(
    messages: AIMessage[],
    onChunk: (chunk: string) => void,
    provider?: ProviderType
  ): Promise<AIResponse> {
    const p = provider || this.currentProvider;

    const cfg = this.getProviderConfig(p);
    this.validateConfig(cfg, p);

    const providerInstance = this.getProvider(p);

    if (providerInstance.streamMessage) {
      return providerInstance.streamMessage(messages, cfg, onChunk);
    }

    // fallback for providers without streaming
    const response = await providerInstance.sendMessage(messages, cfg);
    onChunk(response.content);
    return response;
  }

  // ================================
  // MODEL INFO FOR UI
  // ================================
  public getModelInfo() {
    const cfg = this.getProviderConfig(this.currentProvider);
    return {
      provider: this.currentProvider,
      model: cfg.model,
    };
  }
}
