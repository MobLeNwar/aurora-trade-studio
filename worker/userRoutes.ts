import { Hono } from "hono";
import { getAgentByName } from 'agents';
import { ChatAgent } from './agent';
import { API_RESPONSES } from './config';
import { Env, getAppController, registerSession, unregisterSession } from "./core-utils";
import type { SessionInfo } from "./types";
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
        return agent.fetch(new Request(url.toString(), {
            method: c.req.method,
            headers: c.req.header(),
            body: c.req.method === 'GET' || c.req.method === 'DELETE' ? undefined : c.req.raw.body
        }));
        } catch (error) {
        console.error('Agent routing error:', error);
        return c.json({ success: false, error: API_RESPONSES.AGENT_ROUTING_FAILED }, { status: 500 });
        }
    });
}
export function userRoutes(app: Hono<{ Bindings: Env }>) {
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