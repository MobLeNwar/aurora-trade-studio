import { SMA, RSI } from 'technicalindicators';
import * as ccxt from 'ccxt';
export interface Candle { timestamp: number; open: number; high: number; low: number; close: number; volume: number; }
export interface Strategy {
  type: 'sma-cross' | 'rsi-filter';
  params: { [key: string]: number };
  risk: { positionSizePercent: number; stopLossPercent: number; slippagePercent: number; feePercent: number; trailingStopPercent: number; };
}
export interface Trade { entryTime: number; exitTime: number; entryPrice: number; exitPrice: number; pnl: number; pnlPercent: number; type: 'long' | 'short'; }
export interface BacktestMetrics { netProfit: number; winRate: number; totalTrades: number; profitFactor: number; maxDrawdown: number; sharpeRatio: number; }
export interface BacktestResult { trades: Trade[]; metrics: BacktestMetrics; equityCurve: ({ date: string; value: number;[key: string]: any })[]; indicatorSeries: { [key: string]: (number | undefined)[] }; }
export interface MonteCarloResult { meanPnl: number; stdDev: number; pnlDistribution: number[]; worstDrawdown: number; var95: number; confidenceInterval: [number, number]; }
let lastFetchedData: Candle[] = [];
export async function fetchHistoricalData({ exchange = 'binance', symbol = 'BTC/USDT', timeframe = '1h', limit = 500 }: { exchange?: string; symbol?: string; timeframe?: string; limit?: number }): Promise<Candle[] | null> {
  try {
    const exchangeInstance = new (ccxt as any)[exchange]() as ccxt.Exchange;
    const ohlcv = await exchangeInstance.fetchOHLCV(symbol, timeframe, undefined, limit);
    if (!ohlcv || ohlcv.length < 100) {
      throw new Error(`Insufficient data received from ${exchange}. Got ${ohlcv?.length || 0} candles.`);
    }
    const candles = ohlcv.map(([timestamp, open, high, low, close, volume]: number[]) => ({ timestamp, open, high, low, close, volume }));
    lastFetchedData = candles;
    return candles;
  } catch (error) {
    console.error(`Failed to fetch data from ${exchange} for ${symbol}:`, error);
    if (lastFetchedData.length >= 100) {
      console.warn('Using cached data due to fetch failure.');
      return lastFetchedData;
    }
    console.error('No valid cached data available.');
    return null;
  }
}
export async function fetchLivePrice({ exchange = 'binance', symbol = 'BTC/USDT' }: { exchange?: string; symbol?: string }): Promise<number | null> {
  try {
    const exchangeInstance = new (ccxt as any)[exchange]() as ccxt.Exchange;
    const ticker = await exchangeInstance.fetchTicker(symbol);
    return ticker.last ?? null;
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

/**
 * Perform a simple grid-search over numeric parameter ranges and return the Strategy
 * with the best found params according to runBacktest using metrics.sharpeRatio (higher is better).
 *
 * Keys that exist on strategy.risk are applied to risk; keys that exist on strategy.params are applied to params;
 * unknown keys are added to params.
 *
 * This implementation is intended for small search spaces (exhaustive grid).
 */
export function optimizeParams(strategy: Strategy, paramRanges: Record<string, number[]>, candles: Candle[]): Strategy {
  const keys = Object.keys(paramRanges);
  if (keys.length === 0) return strategy;

  // Build combinations (cartesian product) of the provided ranges.
  let combos: number[][] = [[]];
  for (const k of keys) {
    const vals = paramRanges[k] ?? [];
    if (!Array.isArray(vals) || vals.length === 0) {
      // If a key has no values, skip it in combinations (keeps previous combos unchanged).
      continue;
    }
    const next: number[][] = [];
    for (const combo of combos) {
      for (const v of vals) next.push([...combo, v]);
    }
    combos = next;
  }

  // If combos ended up empty (e.g., all ranges empty), return original strategy.
  if (combos.length === 0) return strategy;

  let bestStrategy: Strategy = strategy;
  let bestSharpe = -Infinity;

  for (const combo of combos) {
    // Create candidate strategy by cloning to avoid mutating the original
    const candidate: Strategy = {
      type: strategy.type,
      params: { ...strategy.params },
      risk: { ...strategy.risk },
    };

    // Apply combo values to candidate
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      // If combo shorter than keys (due to skipped empty ranges), guard access
      const value = combo[i];
      if (typeof value === 'undefined') continue;
      if (key in candidate.risk) {
        // dynamic assignment to risk
        (candidate.risk as any)[key] = value;
      } else if (key in candidate.params) {
        (candidate.params as any)[key] = value;
      } else {
        // unknown keys stored in params
        (candidate.params as any)[key] = value;
      }
    }

    // Evaluate candidate safely
    try {
      const result = runBacktest(candidate, candles);
      const sharpe = result?.metrics?.sharpeRatio ?? 0;
      if (typeof sharpe === 'number' && sharpe > bestSharpe) {
        bestSharpe = sharpe;
        bestStrategy = candidate;
      }
    } catch (e) {
      // Ignore candidates that cause errors and continue searching
      continue;
    }
  }

  return bestStrategy;
}