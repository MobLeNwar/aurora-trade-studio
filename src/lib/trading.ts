import { SMA, RSI } from 'technicalindicators';
import sampleData from '@/pages/TradingSimulatorData.json';
export interface Candle { timestamp: number; open: number; high: number; low: number; close: number; volume: number; }
export interface Signal { symbol: string; vote: 'buy'|'sell'|'hold'; confidence: number; rationale: string; timestamp: number; }
export interface Strategy {
  type: 'sma-cross' | 'rsi-filter';
  params: { [key: string]: number };
  risk: { positionSizePercent: number; stopLossPercent: number; slippagePercent: number; feePercent: number; trailingStopPercent: number; };
}
export interface Trade { entryTime: number; exitTime: number; entryPrice: number; exitPrice: number; pnl: number; pnlPercent: number; type: 'long' | 'short'; }
export interface BacktestMetrics { netProfit: number; winRate: number; totalTrades: number; profitFactor: number; maxDrawdown: number; sharpeRatio: number; }
export interface BacktestResult { trades: Trade[]; metrics: BacktestMetrics; equityCurve: ({ date: string; value: number;[key: string]: any })[]; indicatorSeries: { [key: string]: (number | undefined)[] }; }
export interface MonteCarloResult { meanPnl: number; stdDev: number; pnlDistribution: number[]; worstDrawdown: number; var95: number; confidenceInterval: [number, number]; }
class SimpleEmitter {
  listeners: { [key: string]: ((data: any) => void)[] };
  constructor() {
    this.listeners = {};
  }
  on(event: string, cb: (data: any) => void) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].push(cb);
  }
  emit(event: string, data: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }
}
export class AutonomousBot extends SimpleEmitter {
  symbols: string[];
  exchange: string;
  pollInterval: number;
  interval: NodeJS.Timeout | null;
  constructor(symbols = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'], exchange = 'binance', pollInterval = 300000) {
    super();
    this.symbols = symbols;
    this.exchange = exchange;
    this.pollInterval = pollInterval;
    this.interval = null;
  }
  async scan() {
    console.log(`Scanning symbols: ${this.symbols.join(', ')}`);
    for (const symbol of this.symbols) {
      try {
        const res = await fetch('/api/council-vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ symbol, timeframe: '5m', limit: 50, includeSentiment: true })
        });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: `HTTP Error: ${res.status}` }));
          throw new Error(errorData.error || 'Failed to fetch council vote');
        }
        const data = await res.json();
        if (data.success && data.data.consensus.thresholdMet) {
          const signal: Signal = {
            symbol,
            vote: data.data.consensus.vote,
            confidence: data.data.consensus.majority,
            rationale: data.data.aggregatedRationale,
            timestamp: Date.now()
          };
          this.emit('signal', signal);
          console.log(`Autonomous signal: ${symbol} ${data.data.consensus.vote.toUpperCase()} (${data.data.consensus.majority}%)`);
        }
      } catch (e) {
        console.warn(`Council vote failed for ${symbol}:`, e);
      }
    }
  }
  start() {
    if (this.interval) return;
    console.log('Autonomous bot started.');
    this.scan();
    this.interval = setInterval(() => this.scan(), this.pollInterval);
  }
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      console.log('Autonomous bot stopped.');
    }
  }
}
export const bot = new AutonomousBot();
let lastFetchedData: Candle[] = [];
export async function fetchHistoricalData({ exchange = 'binance', symbol = 'BTC/USDT', timeframe = '1h', limit = 500 }: { exchange?: string; symbol?: string; timeframe?: string; limit?: number }): Promise<Candle[] | null> {
  const cacheKey = `historical-${exchange}-${symbol}-${timeframe}-${limit}`;
  try {
    const cachedItem = localStorage.getItem(cacheKey);
    if (cachedItem) {
      const { data, timestamp } = JSON.parse(cachedItem);
      if (Date.now() - timestamp < 3600000 && Array.isArray(data) && data.length >= 100) {
        console.log(`Using cached data for ${symbol}`);
        lastFetchedData = data;
        return data;
      }
    }
  } catch (e) {
    console.warn('Failed to read from cache', e);
  }
  try {
    const response = await fetch('/api/fetch-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exchange, symbol, timeframe, limit }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: `HTTP Error: ${response.status}` }));
      throw new Error(errorData.error || 'Failed to fetch data from proxy');
    }
    type ProxyResponse = { success?: boolean; data?: any; error?: string; [key: string]: any };
    // attempt to parse as text first to guard against invalid JSON
    const rawText = await response.text().catch(() => '');
    let proxyData: ProxyResponse = {};
    try {
      proxyData = rawText ? JSON.parse(rawText) : {};
    } catch (e) {
      console.warn('Invalid JSON from proxy /api/fetch-data', e);
      proxyData = {};
    }
    if (proxyData && proxyData.success && Array.isArray(proxyData.data) && proxyData.data.length >= 100) {
      // Normalize/validate candle objects to ensure shape matches Candle[]
      const candles: Candle[] = proxyData.data.map((c: any) => {
        if (!c) return null as any;
        const timestamp = Number(c.timestamp ?? c[0]);
        const open = Number(c.open ?? c[1]);
        const high = Number(c.high ?? c[2]);
        const low = Number(c.low ?? c[3]);
        const close = Number(c.close ?? c[4]);
        const volume = Number(c.volume ?? c[5] ?? c[6] ?? 0);
        return { timestamp, open, high, low, close, volume } as Candle;
      }).filter((c: any) => c && Number.isFinite(c.timestamp) && Number.isFinite(c.close));
      lastFetchedData = candles;
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ data: candles, timestamp: Date.now() }));
      } catch (e) {
        console.warn('Failed to write to cache', e);
      }
      return candles;
    } else {
      throw new Error((proxyData && proxyData.error) ? proxyData.error : 'Insufficient data from proxy');
    }
  } catch (error) {
    console.warn(`Failed to fetch data via proxy for ${symbol}:`, error);
    if (lastFetchedData.length >= 100) {
      console.warn('Using last successfully fetched data due to failure.');
      return lastFetchedData;
    }
    console.warn('Using sample fallback data due to fetch failure.');
    return sampleData as Candle[];
  }
}
export async function fetchLivePrice({ exchange = 'binance', symbol = 'BTC/USDT' }: { exchange?: string; symbol?: string }): Promise<number | null> {
  try {
    const resp = await fetch('/api/fetch-price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exchange, symbol }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: `HTTP Error: ${resp.status}` }));
      throw new Error(err?.error || `HTTP Error: ${resp.status}`);
    }
    const data = await resp.json().catch(() => null);
    if (data && typeof data === 'object') {
      const price = Number((data as any).price ?? (data as any).last ?? (data as any).lastPrice);
      return Number.isFinite(price) ? price : null;
    }
    return null;
  } catch (error) {
    console.error(`Failed to fetch live price for ${symbol}:`, error);
    return null;
  }
}
export function runBacktest(strategy: Strategy, candles: Candle[]): BacktestResult {
  if (!candles || candles.length === 0) {
    const emptyMetrics: BacktestMetrics = { netProfit: 0, winRate: 0, totalTrades: 0, profitFactor: 0, maxDrawdown: 0, sharpeRatio: 0 };
    return { trades: [], metrics: emptyMetrics, equityCurve: [], indicatorSeries: {} };
  }
  let equity = 10000;
  const initialEquity = equity;
  const equityCurve: ({ date: string; value: number;[key: string]: any })[] = [{ date: new Date(candles[0].timestamp).toLocaleDateString(), value: equity }];
  const trades: Trade[] = [];
  let position: { entryPrice: number; type: 'long' | 'short'; entryTime: number; virtualStop: number; } | null = null;
  let peakEquity = equity;
  let maxDrawdown = 0;
  const closePrices = candles.map(c => c.close);
  const indicatorSeries: { [key: string]: (number | undefined)[] } = {};
  if (strategy.type === 'sma-cross') {
    indicatorSeries.smaShort = SMA.calculate({ period: strategy.params.shortPeriod || 10, values: closePrices });
    indicatorSeries.smaLong = SMA.calculate({ period: strategy.params.longPeriod || 20, values: closePrices });
  } else if (strategy.type === 'rsi-filter') {
    indicatorSeries.rsi = RSI.calculate({ period: strategy.params.rsiPeriod || 14, values: closePrices });
    indicatorSeries.sma = SMA.calculate({ period: strategy.params.smaPeriod || 50, values: closePrices });
  }
  const closePosition = (exitTime: number, exitPrice: number) => {
    if (!position) return;
    const slippage = exitPrice * (strategy.risk.slippagePercent / 100);
    const finalExitPrice = position.type === 'long' ? exitPrice - slippage : exitPrice + slippage;
    const pnl = (finalExitPrice - position.entryPrice) * (position.type === 'long' ? 1 : -1);
    const fee = (position.entryPrice + finalExitPrice) * (strategy.risk.feePercent / 100);
    const netPnl = pnl - fee;
    const pnlPercent = netPnl / position.entryPrice;
    if (Math.abs(pnlPercent) < 0.0001) { // Avoid micro-trades from slippage/fees
      position = null;
      return;
    }
    equity += equity * (strategy.risk.positionSizePercent / 100) * pnlPercent;
    trades.push({ entryTime: position.entryTime, exitTime, entryPrice: position.entryPrice, exitPrice: finalExitPrice, pnl: netPnl, pnlPercent, type: position.type });
    position = null;
  };
  for (let i = 1; i < candles.length; i++) {
    const candle = candles[i];
    if (position) {
      if (position.type === 'long') {
        position.virtualStop = Math.max(position.virtualStop, candle.high * (1 - (strategy.risk.trailingStopPercent / 100)));
        if (candle.low <= position.virtualStop) closePosition(candle.timestamp, position.virtualStop);
      } else {
        position.virtualStop = Math.min(position.virtualStop, candle.low * (1 + (strategy.risk.trailingStopPercent / 100)));
        if (candle.high >= position.virtualStop) closePosition(candle.timestamp, position.virtualStop);
      }
    }
    let signal: 'buy' | 'sell' | null = null;
    if (strategy.type === 'sma-cross') {
      const shortPeriod = strategy.params.shortPeriod || 10;
      const longPeriod = strategy.params.longPeriod || 20;
      const smaShort = indicatorSeries.smaShort?.[i - shortPeriod];
      const smaLong = indicatorSeries.smaLong?.[i - longPeriod];
      const prevSmaShort = indicatorSeries.smaShort?.[i - shortPeriod - 1];
      const prevSmaLong = indicatorSeries.smaLong?.[i - longPeriod - 1];
      if (smaShort && smaLong && prevSmaShort && prevSmaLong) {
        if (prevSmaShort <= prevSmaLong && smaShort > smaLong) signal = 'buy';
        if (prevSmaShort >= prevSmaLong && smaShort < smaLong) signal = 'sell';
      }
    } else if (strategy.type === 'rsi-filter') {
      const rsi = indicatorSeries.rsi?.[i - (strategy.params.rsiPeriod || 14)];
      const sma = indicatorSeries.sma?.[i - (strategy.params.smaPeriod || 50)];
      const rsiUpper = strategy.params.rsiUpper || 70;
      const rsiLower = strategy.params.rsiLower || 30;
      if (rsi && sma && candle.close > sma) {
        if (rsi < rsiLower) signal = 'buy';
      }
      if (rsi && sma && candle.close < sma) {
        if (rsi > rsiUpper) signal = 'sell';
      }
    }
    if (position) {
      if ((position.type === 'long' && signal === 'sell') || (position.type === 'short' && signal === 'buy')) closePosition(candle.timestamp, candle.open);
    } else if (signal) {
      const slippage = candle.open * (strategy.risk.slippagePercent / 100);
      const entryPrice = signal === 'buy' ? candle.open + slippage : candle.open - slippage;
      const stopPrice = entryPrice * (1 - (strategy.risk.stopLossPercent / 100) * (signal === 'buy' ? 1 : -1));
      position = { entryPrice, type: signal === 'buy' ? 'long' : 'short', entryTime: candle.timestamp, virtualStop: stopPrice };
    }
    const equityPoint: any = { date: new Date(candle.timestamp).toLocaleDateString(), value: equity };
    if (indicatorSeries.smaShort) equityPoint.smaShort = indicatorSeries.smaShort[i - (strategy.params.shortPeriod || 10)];
    if (indicatorSeries.smaLong) equityPoint.smaLong = indicatorSeries.smaLong[i - (strategy.params.longPeriod || 20)];
    equityCurve.push(equityPoint);
    if (equity > peakEquity) peakEquity = equity;
    const drawdown = (peakEquity - equity) / peakEquity;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  const returns = trades.map(t => t.pnlPercent);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / (returns.length || 1);
  const stdDev = Math.sqrt(returns.map(r => Math.pow(r - avgReturn, 2)).reduce((a, b) => a + b, 0) / (returns.length || 1));
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
  const metrics: BacktestMetrics = {
    netProfit: equity - initialEquity,
    winRate: trades.length > 0 ? trades.filter(t => t.pnl > 0).length / trades.length : 0,
    totalTrades: trades.length,
    profitFactor: Math.abs(trades.filter(t => t.pnl <= 0).reduce((s, t) => s + t.pnl, 0)) > 0 ? trades.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0) / Math.abs(trades.filter(t => t.pnl <= 0).reduce((s, t) => s + t.pnl, 0)) : Infinity,
    maxDrawdown,
    sharpeRatio,
  };
  return { trades, metrics, equityCurve, indicatorSeries };
}
export function runMonteCarlo(result: BacktestResult, iterations: number): MonteCarloResult {
  if (result.trades.length === 0) return { meanPnl: 0, stdDev: 0, pnlDistribution: [], worstDrawdown: 0, var95: 0, confidenceInterval: [0, 0] };
  const pnlDistribution: number[] = [];
  let worstDrawdown = 0;
  for (let i = 0; i < iterations; i++) {
    let currentEquity = 10000, peakEquity = currentEquity, maxDrawdown = 0;
    const resampledTrades = Array.from({ length: result.trades.length }, () => result.trades[Math.floor(Math.random() * result.trades.length)]);
    for (const trade of resampledTrades) {
      currentEquity *= (1 + trade.pnlPercent);
      if (currentEquity > peakEquity) peakEquity = currentEquity;
      const drawdown = (peakEquity - currentEquity) / peakEquity;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
    pnlDistribution.push(currentEquity - 10000);
    if (maxDrawdown > worstDrawdown) worstDrawdown = maxDrawdown;
  }
  const meanPnl = pnlDistribution.reduce((a, b) => a + b, 0) / iterations;
  const stdDev = Math.sqrt(pnlDistribution.map(x => Math.pow(x - meanPnl, 2)).reduce((a, b) => a + b, 0) / iterations);
  pnlDistribution.sort((a, b) => a - b);
  const var95 = pnlDistribution[Math.floor(iterations * 0.05)];
  const confidenceInterval: [number, number] = [meanPnl - 1.96 * stdDev, meanPnl + 1.96 * stdDev];
  return { meanPnl, stdDev, pnlDistribution, worstDrawdown, var95, confidenceInterval };
}
export function parseCsvData(csvString: string): Candle[] {
  const rows = csvString.trim().split('\n').slice(1);
  return rows.map(row => {
    const [timestamp, open, high, low, close, volume] = row.split(',');
    const ts = new Date(timestamp).getTime();
    if (isNaN(ts)) {
        const parsedTs = Date.parse(timestamp);
        if (!isNaN(parsedTs)) return { timestamp: parsedTs, open: parseFloat(open), high: parseFloat(high), low: parseFloat(low), close: parseFloat(close), volume: parseFloat(volume) };
    }
    return { timestamp: ts, open: parseFloat(open), high: parseFloat(high), low: parseFloat(low), close: parseFloat(close), volume: parseFloat(volume) };
  }).filter(c => !isNaN(c.timestamp) && !isNaN(c.close));
}
export function validateSignal(strategy: Strategy, signal: Signal, candles: Candle[]): BacktestMetrics {
  const mockResult = runBacktest(strategy, candles.slice(-100));
  const hypotheticalWinRate = mockResult.metrics.winRate * (signal.confidence / 100);
  if (hypotheticalWinRate >= 0.8) {
    console.warn('Disclaimer: Simulated 80%+ win rate based on signal confidence. This is a hypothetical projection and not a guarantee of future performance.');
  }
  return mockResult.metrics;
}
export function optimizeParams(strategy: Strategy, paramRanges: Record<string, number[]>, candles: Candle[]): Strategy {
  const keys = Object.keys(paramRanges);
  if (keys.length === 0) return strategy;
  const ranges: Record<string, number[]> = {};
  for (const k of keys) {
    const vals = paramRanges[k];
    if (Array.isArray(vals) && vals.length > 0) ranges[k] = vals.slice();
    else {
      const fallback = (k in strategy.params ? (strategy.params as any)[k] : (k in strategy.risk ? (strategy.risk as any)[k] : undefined));
      ranges[k] = typeof fallback === 'number' ? [fallback] : [0];
    }
  }
  let seed = 123456789;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const buildCandidate = (values: number[]): Strategy => {
    const candidate: Strategy = { type: strategy.type, params: { ...strategy.params }, risk: { ...strategy.risk } };
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const val = values[i];
      if (key in candidate.risk) (candidate.risk as any)[key] = val;
      else if (key in candidate.params) (candidate.params as any)[key] = val;
      else (candidate.params as any)[key] = val;
    }
    return candidate;
  };
  const populationSize = Math.min(30, Math.max(6, keys.length * 3));
  const population: { values: number[]; fitness: number; sharpe: number; winRate: number }[] = [];
  for (let i = 0; i < populationSize; i++) {
    const vals: number[] = [];
    for (const k of keys) {
      const r = ranges[k];
      const idx = Math.floor(rand() * r.length);
      vals.push(r[idx]);
    }
    population.push({ values: vals, fitness: -Infinity, sharpe: 0, winRate: 0 });
  }
  let bestStrategy: Strategy = strategy;
  let bestFitness = -Infinity;
  const evaluate = (entry: { values: number[]; fitness: number; sharpe: number; winRate: number }) => {
    try {
      const candidate = buildCandidate(entry.values);
      const res = runBacktest(candidate, candles);
      const sharpe = res?.metrics?.sharpeRatio ?? 0;
      const winRate = res?.metrics?.winRate ?? 0;
      let fitness = sharpe;
      if (winRate >= 0.8) fitness += 0.5;
      entry.fitness = fitness;
      entry.sharpe = sharpe;
      entry.winRate = winRate;
      return true;
    } catch (e) {
      entry.fitness = -Infinity;
      entry.sharpe = 0;
      entry.winRate = 0;
      return false;
    }
  };
  for (const p of population) {
    evaluate(p);
    if (p.fitness > bestFitness) {
      bestFitness = p.fitness;
      bestStrategy = buildCandidate(p.values);
    }
  }
  const generations = 40;
  for (let gen = 0; gen < generations; gen++) {
    population.sort((a, b) => b.fitness - a.fitness);
    if (population[0].sharpe > 2 && population[0].winRate > 0.8) {
      bestStrategy = buildCandidate(population[0].values);
      break;
    }
    const eliteCount = Math.max(2, Math.floor(populationSize * 0.2));
    const nextGen: typeof population = population.slice(0, eliteCount).map(e => ({ values: e.values.slice(), fitness: e.fitness, sharpe: e.sharpe, winRate: e.winRate }));
    while (nextGen.length < populationSize) {
      const pickParent = () => {
        const a = population[Math.floor(rand() * population.length)];
        const b = population[Math.floor(rand() * population.length)];
        return (a.fitness > b.fitness) ? a : b;
      };
      const p1 = pickParent();
      const p2 = pickParent();
      const childVals: number[] = [];
      for (let i = 0; i < keys.length; i++) {
        const takeFromP1 = rand() > 0.5;
        const v = takeFromP1 ? p1.values[i] : p2.values[i];
        childVals.push(v);
      }
      const mutationRate = 0.15;
      for (let i = 0; i < keys.length; i++) {
        if (rand() < mutationRate) {
          const r = ranges[keys[i]];
          const idx = Math.floor(rand() * r.length);
          childVals[i] = r[idx];
        }
      }
      const child = { values: childVals, fitness: -Infinity, sharpe: 0, winRate: 0 };
      evaluate(child);
      nextGen.push(child);
      if (child.fitness > bestFitness) {
        bestFitness = child.fitness;
        bestStrategy = buildCandidate(child.values);
      }
    }
    population.length = 0;
    population.push(...nextGen);
  }
  return bestStrategy;
}