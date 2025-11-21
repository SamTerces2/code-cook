import OpenAI from "openai";
import { AIMessage, AIProviderConfig, AIResponse, IAIProvider } from "../types";

export class OpenAIProvider implements IAIProvider {
  async sendMessage(
    messages: AIMessage[],
    config: AIProviderConfig
  ): Promise<AIResponse> {
    const client = new OpenAI({
      apiKey: config.apiKey,
    });

    try {
      const response = await client.chat.completions.create({
        model: config.model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: config.maxTokens,
        temperature: config.temperature,
      });

      const content = response.choices[0]?.message?.content || "";

      return {
        content,
        model: response.model,
        usage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
      };
    } catch (error: any) {
      throw new Error(`OpenAI API Error: ${error.message}`);
    }
  }

  async streamMessage(
    messages: AIMessage[],
    config: AIProviderConfig,
    onChunk: (chunk: string) => void
  ): Promise<AIResponse> {
    const client = new OpenAI({
      apiKey: config.apiKey,
    });

    try {
      let fullContent = "";
      let model = config.model;

      const stream = await client.chat.completions.create({
        model: config.model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullContent += content;
          onChunk(content);
        }
        if (chunk.model) {
          model = chunk.model;
        }
      }

      return {
        content: fullContent,
        model,
      };
    } catch (error: any) {
      throw new Error(`OpenAI API Error: ${error.message}`);
    }
  }
}
