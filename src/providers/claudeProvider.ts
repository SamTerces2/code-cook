import Anthropic from "@anthropic-ai/sdk";
import { AIMessage, AIProviderConfig, AIResponse, IAIProvider } from "../types";

export class ClaudeProvider implements IAIProvider {
  async sendMessage(
    messages: AIMessage[],
    config: AIProviderConfig
  ): Promise<AIResponse> {
    const client = new Anthropic({
      apiKey: config.apiKey,
    });

    // Convert messages to Claude format
    const systemMessage = messages.find((m) => m.role === "system");
    const conversationMessages = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    try {
      const response = await client.messages.create({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        system: systemMessage?.content,
        messages: conversationMessages,
      });

      const content =
        response.content[0].type === "text" ? response.content[0].text : "";

      return {
        content,
        model: response.model,
        usage: {
          promptTokens: response.usage.input_tokens,
          completionTokens: response.usage.output_tokens,
          totalTokens:
            response.usage.input_tokens + response.usage.output_tokens,
        },
      };
    } catch (error: any) {
      throw new Error(`Claude API Error: ${error.message}`);
    }
  }

  async streamMessage(
    messages: AIMessage[],
    config: AIProviderConfig,
    onChunk: (chunk: string) => void
  ): Promise<AIResponse> {
    const client = new Anthropic({
      apiKey: config.apiKey,
    });

    const systemMessage = messages.find((m) => m.role === "system");
    const conversationMessages = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    try {
      let fullContent = "";
      let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      let model = config.model;

      const stream = await client.messages.create({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        system: systemMessage?.content,
        messages: conversationMessages,
        stream: true,
      });

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          const chunk = event.delta.text;
          fullContent += chunk;
          onChunk(chunk);
        }

        if (event.type === "message_start") {
          model = event.message.model;
          usage.promptTokens = event.message.usage.input_tokens;
        }

        if (event.type === "message_delta" && event.usage) {
          usage.completionTokens = event.usage.output_tokens;
          usage.totalTokens = usage.promptTokens + usage.completionTokens;
        }
      }

      return {
        content: fullContent,
        model,
        usage,
      };
    } catch (error: any) {
      throw new Error(`Claude API Error: ${error.message}`);
    }
  }
}
