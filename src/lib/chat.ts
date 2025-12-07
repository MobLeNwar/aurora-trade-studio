import { format } from 'date-fns';
import type { Message, ChatState, ToolCall, SessionInfo } from '../../worker/types';
import type { Strategy, BacktestResult, MonteCarloResult } from './trading';
export interface ChatResponse {
  success: boolean;
  data?: ChatState;
  error?: string;
}
export const MODELS = [
  { id: 'nim/meta/llama-3.1-70b-instruct', name: 'NVIDIA Llama 3.1 70B' },
  { id: 'nim/mistralai/mistral-nemo-12b-instruct', name: 'NVIDIA Mistral Nemo 12B' },
  { id: 'google-ai-studio/gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'google-ai-studio/gemini-2.5-pro', name: 'Gemini 2.5 Pro' },
];
export const formatTime = (ts: number) => format(new Date(ts), 'HH:mm');
export const renderToolCall = (tool: ToolCall) => `${tool.name}(${JSON.stringify(tool.arguments).slice(0, 50)}...)`;
export const generateSessionTitle = (msg?: string) => msg ? `${msg.slice(0, 40)}... • ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : `Strategy • ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
class ChatService {
  private sessionId: string;
  private baseUrl: string;
  constructor() {
    this.sessionId = crypto.randomUUID();
    this.baseUrl = `/api/chat/${this.sessionId}`;
  }
  private async fetchApi(url: string, options?: RequestInit): Promise<any> {
    try {
      const response = await fetch(url, options);
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      }
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorBody.error || `HTTP ${response.status}`);
      }
      return response;
    } catch (error) {
      console.error(`API call to ${url} failed:`, error);
      throw error;
    }
  }
  async sendMessage(message: string, model?: string, onChunk?: (chunk: string) => void): Promise<ChatResponse> {
    try {
      if (model?.startsWith('nim/')) {
        console.log(`NIM Query sent: ${message}`);
      }
      const response = await this.fetchApi(`${this.baseUrl}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, model, stream: !!onChunk }),
      });
      if (onChunk && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          onChunk(decoder.decode(value, { stream: true }));
        }
        return { success: true };
      }
      return await response.json();
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to send message' };
    }
  }
  async getMessages(): Promise<ChatResponse> {
    try {
      const response = await this.fetchApi(`${this.baseUrl}/messages`);
      return await response.json();
    } catch (error) {
      return { success: false, error: 'Failed to load messages' };
    }
  }
  getSessionId(): string { return this.sessionId; }
  newSession(): void {
    this.sessionId = crypto.randomUUID();
    this.baseUrl = `/api/chat/${this.sessionId}`;
  }
  switchSession(sessionId: string): void {
    this.sessionId = sessionId;
    this.baseUrl = `/api/chat/${this.sessionId}`;
  }
  async createSession(title?: string, sessionId?: string, firstMessage?: string, config?: { symbol: string; exchange: string }): Promise<{ success: boolean; data?: { sessionId: string; title: string }; error?: string }> {
    try {
      const response = await this.fetchApi('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, sessionId, firstMessage, config })
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: 'Failed to create session' };
    }
  }
  async listSessions(): Promise<{ success: boolean; data?: SessionInfo[]; error?: string }> {
    try {
      const response = await this.fetchApi('/api/sessions');
      return await response.json();
    } catch (error) {
      return { success: false, error: 'Failed to list sessions' };
    }
  }
  async getSession(sessionId: string): Promise<{ success: boolean; data?: SessionInfo; error?: string }> {
    try {
      const response = await this.fetchApi(`/api/sessions/${sessionId}`);
      return await response.json();
    } catch (error) {
      return { success: false, error: 'Failed to get session' };
    }
  }
  async deleteSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await this.fetchApi(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      return await response.json();
    } catch (error) {
      return { success: false, error: 'Failed to delete session' };
    }
  }
  async sendWithContext(message: string, strategy: Strategy, backtestResult: BacktestResult | null, monteCarloResult: MonteCarloResult | null, model?: string, onChunk?: (chunk: string) => void): Promise<ChatResponse> {
    const context = `
      Current Strategy:
      - Type: ${strategy.type}
      - Parameters: ${JSON.stringify(strategy.params)}
      - Risk: ${JSON.stringify(strategy.risk)}
      Latest Backtest Results:
      - ${backtestResult ? `Net Profit: ${backtestResult.metrics.netProfit.toFixed(2)}, Win Rate: ${(backtestResult.metrics.winRate * 100).toFixed(2)}%, Trades: ${backtestResult.metrics.totalTrades}, Max Drawdown: ${(backtestResult.metrics.maxDrawdown * 100).toFixed(2)}%` : 'No backtest run yet.'}
      Monte Carlo Simulation:
      - ${monteCarloResult ? `Mean PnL: ${monteCarloResult.meanPnl.toFixed(2)}, Worst Drawdown: ${(monteCarloResult.worstDrawdown * 100).toFixed(2)}%` : 'Not run yet.'}
      User Query: ${message}
    `;
    return this.sendMessage(context, model, onChunk);
  }
}
export const chatService = new ChatService();