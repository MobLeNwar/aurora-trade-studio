import OpenAI from 'openai';
import type { Message, ToolCall, Candle } from './types';
import { getToolDefinitions, executeTool } from './tools';
import { ChatCompletionMessageFunctionToolCall } from 'openai/resources/index.mjs';
import type { Env } from './core-utils';
/**
 * ChatHandler - Handles all chat-related operations
 *
 * This class encapsulates the OpenAI integration and tool execution logic,
 * making it easy for AI developers to understand and extend the functionality.
 */
export class ChatHandler {
  private client: OpenAI;
  private nimClients: { name: string; client: OpenAI }[] = [];
  private model: string;
  constructor(env: Env, model: string) {
    this.client = new OpenAI({
      baseURL: env.CF_AI_BASE_URL,
      apiKey: env.CF_AI_API_KEY
    });
    if (env.NIM_BASE_URL && env.NIM_API_KEY) {
      const nimConfig = { baseURL: env.NIM_BASE_URL, apiKey: env.NIM_API_KEY };
      this.nimClients = [
        { name: 'meta/llama-3.1-405b-instruct', client: new OpenAI(nimConfig) },
        { name: 'meta/llama-3.1-70b-instruct', client: new OpenAI(nimConfig) },
        { name: 'mistralai/mistral-nemo-12b-instruct', client: new OpenAI(nimConfig) },
      ];
      console.log(`NVIDIA NIM clients initialized for: ${this.nimClients.map(c => c.name).join(', ')}`);
    }
    this.model = model;
  }
  /**
   * Process a user message and generate AI response with optional tool usage
   */
  async processMessage(
    message: string,
    conversationHistory: Message[],
    onChunk?: (chunk: string) => void,
    context?: { candles?: Candle[]; sentiment?: string }
  ): Promise<{
    content: string;
    toolCalls?: ToolCall[];
    councilResponse?: any;
  }> {
    if (message.toLowerCase().includes('council vote') && context?.candles) {
      const councilResponse = await this.processCouncilQuery(message, context.candles, context.sentiment);
      return {
        content: councilResponse.aggregatedRationale,
        councilResponse,
      };
    }
    const messages = this.buildConversationMessages(message, conversationHistory);
    const toolDefinitions = await getToolDefinitions();
    const isNimModel = this.model.startsWith('nim/') && this.nimClients.some(c => this.model.includes(c.name.split('/')[1]));
    let activeClient = this.client;
    let modelToUse = this.model;
    if (isNimModel) {
      const nimModelName = this.model.replace('nim/', '');
      const nimClientEntry = this.nimClients.find(c => c.name === nimModelName);
      if (nimClientEntry) {
        activeClient = nimClientEntry.client;
        modelToUse = nimModelName;
      }
    }
    console.log(`Using ${isNimModel ? 'NIM' : 'CF AI Gateway'} for model: ${modelToUse}`);
    const commonParams = {
      model: modelToUse,
      messages,
      tools: toolDefinitions,
      tool_choice: 'auto' as const,
      max_tokens: 4096,
    };
    if (onChunk) {
      const stream = await activeClient.chat.completions.create({ ...commonParams, stream: true });
      return this.handleStreamResponse(stream, message, conversationHistory, onChunk);
    }
    const completion = await activeClient.chat.completions.create({ ...commonParams, stream: false });
    return this.handleNonStreamResponse(completion, message, conversationHistory);
  }
  async processCouncilQuery(
    userMessage: string,
    candles: Candle[],
    sentiment?: string
  ): Promise<{
    votes: Array<{ model: string; vote: 'buy' | 'sell' | 'hold'; confidence: number; rationale: string }>;
    consensus: { vote: string; thresholdMet: boolean; majority: number };
    aggregatedRationale: string;
  }> {
    if (this.nimClients.length === 0) {
      throw new Error("NIM clients are not configured for council voting.");
    }
    const candleSummary = `Latest ${candles.length} candles provided, ending at ${new Date(candles[candles.length - 1].timestamp).toISOString()}. Last close: ${candles[candles.length - 1].close}.`;
    const sentimentSummary = sentiment ? `Current sentiment is: ${sentiment}.` : 'No sentiment data provided.';
    const prompt = `
      As an expert trading AI, analyze the provided market data and sentiment to make a trading decision.
      Data context: ${candleSummary}
      Sentiment context: ${sentimentSummary}
      Your task is to vote on the next likely market direction.
      Respond ONLY with a JSON object with the following structure:
      {
        "vote": "buy" | "sell" | "hold",
        "confidence": number,
        "rationale": "A brief explanation for your vote, based on technical indicators or sentiment."
      }
    `;
    const promises = this.nimClients.map(async ({ name, client }) => {
      try {
        const completion = await client.chat.completions.create({
          model: name,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 256,
          temperature: 0.5,
          response_format: { type: 'json_object' },
        });
        const resultText = completion.choices[0]?.message?.content;
        if (!resultText) throw new Error('Empty response from model');
        const parsedResult = JSON.parse(resultText);
        return { model: name, ...parsedResult };
      } catch (error) {
        console.error(`Error from model ${name}:`, error);
        return { model: name, vote: 'hold', confidence: 0, rationale: `Error during analysis: ${error instanceof Error ? error.message : 'Unknown'}` };
      }
    });
    const votes = await Promise.all(promises);
    const voteCounts: Record<'buy' | 'sell' | 'hold', number> = { buy: 0, sell: 0, hold: 0 };
    let aggregatedRationale = "AI Council Rationales:\n";
    votes.forEach(v => {
      if (v.vote === 'buy' || v.vote === 'sell' || v.vote === 'hold') {
        voteCounts[v.vote]++;
      }
      aggregatedRationale += `- ${v.model}: ${v.rationale} (Confidence: ${v.confidence}%)\n`;
    });
    let consensusVote = 'hold';
    let maxVotes = 0;
    for (const [vote, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) {
        maxVotes = count;
        consensusVote = vote;
      }
    }
    const majority = (maxVotes / votes.length) * 100;
    const thresholdMet = majority >= 70;
    return {
      votes,
      consensus: { vote: consensusVote, thresholdMet, majority },
      aggregatedRationale,
    };
  }
  private async handleStreamResponse(
    stream: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>,
    message: string,
    conversationHistory: Message[],
    onChunk: (chunk: string) => void
  ) {
    let fullContent = '';
    const accumulatedToolCalls: ChatCompletionMessageFunctionToolCall[] = [];
    try {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          fullContent += delta.content;
          onChunk(delta.content);
        }
        if (delta?.tool_calls) {
          for (let i = 0; i < delta.tool_calls.length; i++) {
            const deltaToolCall = delta.tool_calls[i];
            if (!accumulatedToolCalls[i]) {
              accumulatedToolCalls[i] = {
                id: deltaToolCall.id || `tool_${Date.now()}_${i}`,
                type: 'function',
                function: {
                  name: deltaToolCall.function?.name || '',
                  arguments: deltaToolCall.function?.arguments || ''
                }
              };
            } else {
              if (deltaToolCall.function?.name && !accumulatedToolCalls[i].function.name) {
                accumulatedToolCalls[i].function.name = deltaToolCall.function.name;
              }
              if (deltaToolCall.function?.arguments) {
                accumulatedToolCalls[i].function.arguments += deltaToolCall.function?.arguments;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Stream processing error:', error);
      throw new Error('Stream processing failed');
    }
    if (accumulatedToolCalls.length > 0) {
      const executedTools = await this.executeToolCalls(accumulatedToolCalls);
      const finalResponse = await this.generateToolResponse(message, conversationHistory, accumulatedToolCalls, executedTools);
      return { content: finalResponse, toolCalls: executedTools };
    }
    return { content: fullContent };
  }
  private async handleNonStreamResponse(
    completion: OpenAI.Chat.Completions.ChatCompletion,
    message: string,
    conversationHistory: Message[]
  ) {
    const responseMessage = completion.choices[0]?.message;
    if (!responseMessage) {
      return { content: 'I apologize, but I encountered an issue processing your request.' };
    }
    if (!responseMessage.tool_calls) {
      return {
        content: responseMessage.content ?? 'I apologize, but I encountered an issue.'
      };
    }
    const toolCalls = await this.executeToolCalls(responseMessage.tool_calls as ChatCompletionMessageFunctionToolCall[]);
    const finalResponse = await this.generateToolResponse(
      message,
      conversationHistory,
      responseMessage.tool_calls,
      toolCalls
    );
    return { content: finalResponse, toolCalls };
  }
  private async executeToolCalls(openAiToolCalls: ChatCompletionMessageFunctionToolCall[]): Promise<ToolCall[]> {
    return Promise.all(
      openAiToolCalls.map(async (tc) => {
        let args = {};
        try {
          if (tc.function.arguments) {
            args = JSON.parse(tc.function.arguments);
          }
        } catch (error) {
          console.error(`Failed to parse arguments for ${tc.function.name}:`, tc.function.arguments);
        }
        try {
          const result = await executeTool(tc.function.name, args);
          return {
            id: tc.id,
            name: tc.function.name,
            arguments: args,
            result
          };
        } catch (error) {
          console.error(`Tool execution failed for ${tc.function.name}:`, error);
          return {
            id: tc.id,
            name: tc.function.name,
            arguments: args,
            result: { error: `Failed to execute ${tc.function.name}: ${error instanceof Error ? error.message : 'Unknown error'}` }
          };
        }
      })
    );
  }
  private async generateToolResponse(
    userMessage: string,
    history: Message[],
    openAiToolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[],
    toolResults: ToolCall[]
  ): Promise<string> {
    const isNimModel = this.model.startsWith('nim/') && this.nimClients.some(c => this.model.includes(c.name.split('/')[1]));
    let activeClient = this.client;
    let modelToUse = this.model;
    if (isNimModel) {
      const nimModelName = this.model.replace('nim/', '');
      const nimClientEntry = this.nimClients.find(c => c.name === nimModelName);
      if (nimClientEntry) {
        activeClient = nimClientEntry.client;
        modelToUse = nimModelName;
      }
    }
    const followUpCompletion = await activeClient.chat.completions.create({
      model: modelToUse,
      messages: [
        { role: 'system', content: 'You are a helpful AI assistant. Respond naturally to the tool results.' },
        ...history.slice(-3).map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: userMessage },
        {
          role: 'assistant',
          content: null,
          tool_calls: openAiToolCalls
        },
        ...toolResults.map((result, index) => ({
          role: 'tool' as const,
          content: JSON.stringify(result.result),
          tool_call_id: openAiToolCalls[index]?.id || result.id
        }))
      ],
      max_tokens: 4096
    });
    return followUpCompletion.choices[0]?.message?.content ?? 'Tool results processed successfully.';
  }
  private buildConversationMessages(userMessage: string, history: Message[]) {
    return [
      {
        role: 'system' as const,
        content: 'You are a helpful AI trading assistant for Aurora Trade Studio. You provide clear, concise guidance on trading strategies, backtest results, and market analysis. Keep responses practical and actionable.'
      },
      ...history.slice(-5).map(m => ({
        role: m.role,
        content: m.content
      })),
      { role: 'user' as const, content: userMessage }
    ];
  }
  updateModel(newModel: string): void {
    this.model = newModel;
  }
}