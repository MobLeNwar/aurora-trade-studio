import { Hono } from "hono";
import { getAgentByName } from 'agents';
import { ChatAgent } from './agent';
import { API_RESPONSES } from './config';
import { Env, getAppController, registerSession, unregisterSession } from "./core-utils";
import type { SessionInfo, Candle } from "./types";
/**
 * DO NOT MODIFY THIS FUNCTION. Only for your reference.
 */
export function coreRoutes(app: Hono<{ Bindings: Env }>) {
    // Use this API for conversations. **DO NOT MODIFY**
    app.all('/api/chat/:sessionId/*', async (c) => {
        try {
        const sessionId = c.req.param('sessionId');
        const agent = await getAgentByName<Env, ChatAgent>(c.env.CHAT_AGENT, sessionId); // Get existing agent or create a new one if it doesn't exist, with sessionId as the name
        const url = new URL(c.req.url);
        url.pathname = url.pathname.replace(`/api/chat/${sessionId}`, '');
        // IMPORTANT: Pass the full body to the agent to support context like candles
        const requestBody = c.req.method === 'GET' || c.req.method === 'DELETE' ? undefined : await c.req.json().catch(() => ({}));
        return agent.fetch(new Request(url.toString(), {
            method: c.req.method,
            headers: c.req.header(),
            body: requestBody ? JSON.stringify(requestBody) : undefined
        }));
        } catch (error) {
        console.error('Agent routing error:', error);
        return c.json({ success: false, error: API_RESPONSES.AGENT_ROUTING_FAILED }, { status: 500 });
        }
    });
}
export function userRoutes(app: Hono<{ Bindings: Env }>) {
    app.post('/api/council-vote', async (c) => {
        const { symbol = 'BTC/USDT', timeframe = '5m', limit = 50, includeSentiment = true } = await c.req.json();
        try {
            // NOTE: Rate limiting would be implemented here using a Durable Object
            // to track last vote timestamp per symbol. Skipped due to file constraints.
            // 1. Fetch candles
            const ccxtModule = await import('ccxt');
            const ExchangeClass = (ccxtModule as any)['binance'];
            if (!ExchangeClass) return c.json({ success: false, error: 'Invalid exchange' }, 400);
            const exchangeInstance = new ExchangeClass({ enableRateLimit: true });
            const ohlcv = await exchangeInstance.fetchOHLCV(symbol, timeframe, undefined, limit);
            if (!ohlcv || ohlcv.length < 10) {
                return c.json({ success: false, error: 'Insufficient candle data' }, 400);
            }
            const candles: Candle[] = ohlcv.map(([ts, o, h, l, c, v]: number[]) => ({ timestamp: ts, open: o, high: h, low: l, close: c, volume: v }));
            // 2. Fetch sentiment (mocked)
            let sentiment = 'neutral';
            if (includeSentiment) {
                const sentimentScore = Math.random() * 2 - 1;
                sentiment = sentimentScore > 0.3 ? `bullish (${sentimentScore.toFixed(2)})` : sentimentScore < -0.3 ? `bearish (${sentimentScore.toFixed(2)})` : `neutral (${sentimentScore.toFixed(2)})`;
            }
            // 3. Call agent for council vote
            const agentId = `council-agent-${crypto.randomUUID()}`;
            const agent = await getAgentByName<Env, ChatAgent>(c.env.CHAT_AGENT, agentId);
            const requestBody = {
                message: `Council vote on ${symbol}`,
                model: 'nim/meta/llama-3.1-405b-instruct',
                stream: false,
                context: { candles, sentiment }
            };
            const agentUrl = new URL(c.req.url);
            agentUrl.pathname = `/api/chat/${agentId}/chat`;
            const agentResponse = await c.env.CHAT_AGENT.get(c.env.CHAT_AGENT.idFromName(agentId)).fetch(new Request(agentUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            }));
            if (!agentResponse.ok) {
                const errorText = await agentResponse.text();
                throw new Error(`Agent failed with status ${agentResponse.status}: ${errorText}`);
            }
            const responseJson = await agentResponse.json();
            const councilData = responseJson.data?.councilResponse;
            if (!councilData) {
                return c.json({ success: false, error: 'Agent did not return council vote data', agentResponse: responseJson }, 500);
            }
            // 4. Log session
            await registerSession(c.env, `vote-${symbol}-${Date.now()}`, `Council Vote: ${symbol}`, {
                config: { symbol, exchange: 'binance' },
                strategy: JSON.stringify(councilData.consensus)
            });
            return c.json({ success: true, data: councilData });
        } catch (e: any) {
            console.error('Council vote error:', e);
            return c.json({ success: false, error: e.message }, 500);
        }
    });
    app.post('/api/fetch-data', async (c) => {
        try {
            const { exchange: ex, symbol, timeframe = '1h', limit = 500 } = await c.req.json();
            const ccxtModule = await import('ccxt');
            const ExchangeClass = (ccxtModule as any)[ex];
            if (!ExchangeClass) {
                return c.json({ success: false, error: 'Invalid exchange' }, 400);
            }
            const exchangeInstance = new ExchangeClass({
                rateLimit: 1200,
                enableRateLimit: true,
                options: { defaultType: 'spot', adjustForTimeDifference: true }
            });
            const ohlcv = await exchangeInstance.fetchOHLCV(symbol, timeframe, undefined, limit, {
                headers: { 'User-Agent': 'AuroraTradeStudio/1.0' }
            });
            if (!ohlcv || ohlcv.length < 100) {
                return c.json({ success: false, error: 'Insufficient data' }, 400);
            }
            const candles = ohlcv.map(([ts, o, h, l, c, v]: number[]) => ({ timestamp: ts, open: o, high: h, low: l, close: c, volume: v }));
            return c.json({ success: true, data: candles });
        } catch (error: any) {
            console.error('Proxy fetch error:', error);
            return c.json({ success: false, error: error.message }, 500);
        }
    });
    app.post('/api/fetch-price', async (c) => {
        try {
            const { exchange: ex, symbol } = await c.req.json();
            if (!ex || !symbol) {
                return c.json({ success: false, error: 'Missing exchange or symbol' }, 400);
            }
            const ccxtModule = await import('ccxt');
            const ExchangeClass = (ccxtModule as any)[ex];
            if (!ExchangeClass) {
                return c.json({ success: false, error: 'Invalid exchange' }, 400);
            }
            const exchangeInstance = new ExchangeClass({
                rateLimit: 1200,
                enableRateLimit: true,
                options: { defaultType: 'spot', adjustForTimeDifference: true }
            });
            const ticker = await exchangeInstance.fetchTicker(symbol, {
                headers: { 'User-Agent': 'AuroraTradeStudio/1.0' }
            });
            const last = ticker && (ticker.last ?? ticker.price ?? ticker.close);
            if (last === undefined || last === null) {
                return c.json({ success: false, error: 'Price not available' }, 500);
            }
            return c.json({ success: true, price: last });
        } catch (error: any) {
            console.error('Proxy price fetch error:', error);
            return c.json({ success: false, error: error.message }, 500);
        }
    });
    app.get('/api/sessions', async (c) => {
        try {
            const controller = getAppController(c.env);
            const sessions = await controller.listSessions();
            return c.json({ success: true, data: sessions });
        } catch (error) {
            return c.json({ success: false, error: 'Failed to retrieve sessions' }, { status: 500 });
        }
    });
    app.post('/api/sessions', async (c) => {
        try {
            const body = await c.req.json().catch(() => ({}));
            const { title, sessionId: providedSessionId, firstMessage, config } = body;
            const sessionId = providedSessionId || crypto.randomUUID();
            let sessionTitle = title;
            if (!sessionTitle) {
                sessionTitle = firstMessage && firstMessage.trim()
                    ? `${firstMessage.trim().slice(0, 40)}...`
                    : `Chat ${new Date().toLocaleString()}`;
            }
            const sessionInfo: Partial<SessionInfo> = { config };
            try {
                if (firstMessage && firstMessage.startsWith('{')) {
                    JSON.parse(firstMessage); // Validate JSON
                    sessionInfo.strategy = firstMessage;
                }
            } catch (e) { /* Not a strategy JSON */ }
            await registerSession(c.env, sessionId, sessionTitle, sessionInfo);
            return c.json({ success: true, data: { sessionId, title: sessionTitle } });
        } catch (error) {
            return c.json({ success: false, error: 'Failed to create session' }, { status: 500 });
        }
    });
    app.get('/api/sessions/:sessionId', async (c) => {
        try {
            const controller = getAppController(c.env);
            const session = await controller.getSession(c.req.param('sessionId'));
            if (!session) {
                return c.json({ success: false, error: 'Session not found' }, { status: 404 });
            }
            return c.json({ success: true, data: session });
        } catch (error) {
            return c.json({ success: false, error: 'Failed to retrieve session' }, { status: 500 });
        }
    });
    app.delete('/api/sessions/:sessionId', async (c) => {
        try {
            const sessionId = c.req.param('sessionId');
            const deleted = await unregisterSession(c.env, sessionId);
            if (!deleted) return c.json({ success: false, error: 'Session not found' }, { status: 404 });
            return c.json({ success: true, data: { deleted: true } });
        } catch (error) {
            return c.json({ success: false, error: 'Failed to delete session' }, { status: 500 });
        }
    });
    app.get('/api/alpaca-config', (c) => {
        return c.json({
            success: true,
            data: {
                configured: !!(c.env.ALPACA_API_KEY && c.env.ALPACA_SECRET_KEY)
            }
        });
    });
}