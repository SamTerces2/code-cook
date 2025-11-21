// src/providers/ollamaProvider.ts
import { AIMessage, AIProviderConfig, AIResponse, IAIProvider } from "../types";

const OLLAMA_ENDPOINT = "http://127.0.0.1:11434/api/chat";

export class OllamaProvider implements IAIProvider {
  private toOllamaMessages(messages: AIMessage[]) {
    return messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));
  }

  async sendMessage(
    messages: AIMessage[],
    config: AIProviderConfig
  ): Promise<AIResponse> {
    try {
      const res = await fetch(OLLAMA_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          messages: this.toOllamaMessages(messages),
          stream: false,
          options: {
            temperature: config.temperature,
            num_predict: config.maxTokens,
          },
        }),
      });

      const data: any = await res.json();
      const content: string = data?.message?.content ?? "";

      return {
        content,
        model: data?.model ?? config.model,
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
      };
    } catch (error: any) {
      throw new Error(`Ollama API Error: ${error.message}`);
    }
  }

  async streamMessage(
    messages: AIMessage[],
    config: AIProviderConfig,
    onChunk: (chunk: string) => void
  ): Promise<AIResponse> {
    let fullContent = "";
    let model = config.model;

    try {
      const res = await fetch(OLLAMA_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          messages: this.toOllamaMessages(messages),
          stream: true,
          options: {
            temperature: config.temperature,
            num_predict: config.maxTokens,
          },
        }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);

          if (!line) continue;

          let event: any;
          try {
            event = JSON.parse(line);
          } catch {
            continue;
          }

          if (event?.model) {
            model = event.model;
          }

          const delta = event?.message?.content;
          if (delta) {
            fullContent += delta;
            onChunk(delta);
          }

          if (event?.done) {
            break;
          }
        }
      }

      return {
        content: fullContent,
        model,
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    } catch (error: any) {
      throw new Error(`Ollama API Error: ${error.message}`);
    }
  }
}
