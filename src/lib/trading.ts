import { SMA, RSI } from 'technicalindicators';
export interface Candle { timestamp: number; open: number; high: number; low: number; close: number; volume: number; }
export interface Strategy {
  type: 'sma-cross' | 'rsi-filter';
  params: { [key: string]: number };
  risk: { positionSizePercent: number; stopLossPercent: number; slippagePercent: number; feePercent: number; trailingStopPercent: number; };
}
export interface Trade { entryTime: number; exitTime: number; entryPrice: number; exitPrice: number; pnl: number; pnlPercent: number; type: 'long' | 'short'; }
export interface BacktestMetrics { netProfit: number; winRate: number; totalTrades: number; profitFactor: number; maxDrawdown: number; sharpeRatio: number; }
export interface BacktestResult { trades: Trade[]; metrics: BacktestMetrics; equityCurve: { date: string; value: number }[]; indicatorSeries: { [key: string]: (number | undefined)[] }; }
export interface MonteCarloResult { meanPnl: number; stdDev: number; pnlDistribution: number[]; worstDrawdown: number; var95: number; }
export function runBacktest(strategy: Strategy, candles: Candle[]): BacktestResult {
  let equity = 10000;
  const initialEquity = equity;
  const equityCurve = [{ date: new Date(candles[0].timestamp).toLocaleDateString(), value: equity }];
  const trades: Trade[] = [];
  let position: { entryPrice: number; type: 'long' | 'short'; entryTime: number; virtualStop: number; } | null = null;
  let peakEquity = equity;
  let maxDrawdown = 0;
  const closePrices = candles.map(c => c.close);
  const indicatorSeries: { [key: string]: (number | undefined)[] } = {};
  if (strategy.type === 'sma-cross') {
    indicatorSeries.smaShort = SMA.calculate({ period: strategy.params.shortPeriod, values: closePrices });
    indicatorSeries.smaLong = SMA.calculate({ period: strategy.params.longPeriod, values: closePrices });
  } else if (strategy.type === 'rsi-filter') {
    indicatorSeries.rsi = RSI.calculate({ period: strategy.params.rsiPeriod, values: closePrices });
    indicatorSeries.sma = SMA.calculate({ period: strategy.params.smaPeriod, values: closePrices });
  }
  const closePosition = (exitTime: number, exitPrice: number) => {
    if (!position) return;
    const slippage = exitPrice * (strategy.risk.slippagePercent / 100);
    const finalExitPrice = position.type === 'long' ? exitPrice - slippage : exitPrice + slippage;
    const pnl = (finalExitPrice - position.entryPrice) * (position.type === 'long' ? 1 : -1);
    const fee = (position.entryPrice + finalExitPrice) * (strategy.risk.feePercent / 100);
    const netPnl = pnl - fee;
    const pnlPercent = netPnl / position.entryPrice;
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
      const smaShort = indicatorSeries.smaShort?.[i - strategy.params.shortPeriod];
      const smaLong = indicatorSeries.smaLong?.[i - strategy.params.longPeriod];
      const prevSmaShort = indicatorSeries.smaShort?.[i - strategy.params.shortPeriod - 1];
      const prevSmaLong = indicatorSeries.smaLong?.[i - strategy.params.longPeriod - 1];
      if (smaShort && smaLong && prevSmaShort && prevSmaLong) {
        if (prevSmaShort <= prevSmaLong && smaShort > smaLong) signal = 'buy';
        if (prevSmaShort >= prevSmaLong && smaShort < smaLong) signal = 'sell';
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
    equityCurve.push({ date: new Date(candle.timestamp).toLocaleDateString(), value: equity });
    if (equity > peakEquity) peakEquity = equity;
    const drawdown = (peakEquity - equity) / peakEquity;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  const returns = trades.map(t => t.pnlPercent);
  const avgReturn = returns.reduce((a, b) => a + b, 0) / (returns.length || 1);
  const stdDev = Math.sqrt(returns.map(r => Math.pow(r - avgReturn, 2)).reduce((a, b) => a + b, 0) / (returns.length || 1));
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Assuming daily data
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
  if (result.trades.length === 0) return { meanPnl: 0, stdDev: 0, pnlDistribution: [], worstDrawdown: 0, var95: 0 };
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
  return { meanPnl, stdDev, pnlDistribution, worstDrawdown, var95 };
}
export function optimizeParams(baseStrategy: Strategy, paramRanges: { [key: string]: number[] }, candles: Candle[]): Strategy {
  let bestStrategy = baseStrategy;
  let bestSharpe = -Infinity;
  const paramKeys = Object.keys(paramRanges);
  const combinations = paramKeys.reduce((acc, key) => {
    const newAcc: any[] = [];
    (acc.length ? acc : [{}]).forEach(existingCombo => {
      paramRanges[key].forEach(value => {
        const newCombo = { ...existingCombo };
        if (key in baseStrategy.params) newCombo.params = { ...(newCombo.params || {}), [key]: value };
        else if (key in baseStrategy.risk) newCombo.risk = { ...(newCombo.risk || {}), [key]: value };
        newAcc.push(newCombo);
      });
    });
    return newAcc;
  }, []);
  for (const combo of combinations) {
    const currentStrategy = { ...baseStrategy, params: { ...baseStrategy.params, ...combo.params }, risk: { ...baseStrategy.risk, ...combo.risk } };
    const result = runBacktest(currentStrategy, candles);
    if (result.metrics.sharpeRatio > bestSharpe) {
      bestSharpe = result.metrics.sharpeRatio;
      bestStrategy = currentStrategy;
    }
  }
  return bestStrategy;
}
export function parseCsvData(csvString: string): Candle[] {
  const rows = csvString.trim().split('\n').slice(1);
  return rows.map(row => {
    const [timestamp, open, high, low, close, volume] = row.split(',');
    return { timestamp: new Date(timestamp).getTime(), open: parseFloat(open), high: parseFloat(high), low: parseFloat(low), close: parseFloat(close), volume: parseFloat(volume) };
  }).filter(c => !isNaN(c.timestamp) && !isNaN(c.close));
}