import { SMA, RSI } from 'technicalindicators';
export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
export interface Strategy {
  type: 'sma-cross' | 'rsi-filter';
  params: { [key: string]: number };
  risk: {
    positionSizePercent: number;
    stopLossPercent: number;
    slippagePercent: number;
    feePercent: number;
  };
}
export interface Trade {
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPercent: number;
  type: 'long' | 'short';
}
export interface BacktestMetrics {
  netProfit: number;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio?: number; // Optional for optimization
}
export interface BacktestResult {
  trades: Trade[];
  metrics: BacktestMetrics;
  equityCurve: { date: string; value: number }[];
  indicatorSeries: { [key: string]: (number | undefined)[] };
}
export interface MonteCarloResult {
  meanPnl: number;
  stdDev: number;
  pnlDistribution: number[];
  worstDrawdown: number;
  confidenceInterval: { lower: number; upper: number };
}
export function runBacktest(strategy: Strategy, candles: Candle[]): BacktestResult {
  let equity = 10000;
  const initialEquity = equity;
  const equityCurve: { date: string; value: number }[] = [{ date: new Date(candles[0].timestamp).toLocaleDateString(), value: equity }];
  const trades: Trade[] = [];
  let position: { entryPrice: number; type: 'long' | 'short'; entryTime: number } | null = null;
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
    trades.push({
      entryTime: position.entryTime,
      exitTime: exitTime,
      entryPrice: position.entryPrice,
      exitPrice: finalExitPrice,
      pnl: netPnl,
      pnlPercent: pnlPercent,
      type: position.type,
    });
    position = null;
  };
  const openPosition = (time: number, price: number, type: 'long' | 'short') => {
    const slippage = price * (strategy.risk.slippagePercent / 100);
    const entryPrice = type === 'long' ? price + slippage : price - slippage;
    position = { entryPrice, type, entryTime: time };
  };
  for (let i = 1; i < candles.length; i++) {
    const candle = candles[i];
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
    } else if (strategy.type === 'rsi-filter') {
      const rsiVal = indicatorSeries.rsi?.[i - strategy.params.rsiPeriod];
      const smaVal = indicatorSeries.sma?.[i - strategy.params.smaPeriod];
      if (rsiVal && smaVal) {
        if (candle.close > smaVal && rsiVal < strategy.params.rsiLower) signal = 'buy';
        if (candle.close < smaVal && rsiVal > strategy.params.rsiUpper) signal = 'sell';
      }
    }
    if (position) {
      const pnlPercent = position.type === 'long'
        ? (candle.low - position.entryPrice) / position.entryPrice
        : (position.entryPrice - candle.high) / position.entryPrice;
      if (pnlPercent * 100 < -strategy.risk.stopLossPercent) {
        const exitPrice = position.entryPrice * (1 - (strategy.risk.stopLossPercent / 100) * (position.type === 'long' ? 1 : -1));
        closePosition(candle.timestamp, exitPrice);
      } else if (position.type === 'long' && signal === 'sell') {
        closePosition(candle.timestamp, candle.open);
      } else if (position.type === 'short' && signal === 'buy') {
        closePosition(candle.timestamp, candle.open);
      }
    } else {
      if (signal === 'buy') {
        openPosition(candle.timestamp, candle.open, 'long');
      }
    }
    equityCurve.push({ date: new Date(candle.timestamp).toLocaleDateString(), value: equity });
    if (equity > peakEquity) peakEquity = equity;
    const drawdown = (peakEquity - equity) / peakEquity;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  const winningTrades = trades.filter(t => t.pnl > 0).length;
  const grossProfit = trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0);
  const grossLoss = Math.abs(trades.filter(t => t.pnl <= 0).reduce((sum, t) => sum + t.pnl, 0));
  const metrics: BacktestMetrics = {
    netProfit: equity - initialEquity,
    winRate: trades.length > 0 ? winningTrades / trades.length : 0,
    totalTrades: trades.length,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : Infinity,
    maxDrawdown: maxDrawdown,
  };
  return { trades, metrics, equityCurve, indicatorSeries };
}
export function runMonteCarlo(result: BacktestResult, iterations: number): MonteCarloResult {
  if (result.trades.length === 0) {
    return { meanPnl: 0, stdDev: 0, pnlDistribution: [], worstDrawdown: 0, confidenceInterval: { lower: 0, upper: 0 } };
  }
  const pnlDistribution: number[] = [];
  let worstDrawdown = 0;
  for (let i = 0; i < iterations; i++) {
    let currentEquity = 10000;
    let peakEquity = currentEquity;
    let maxDrawdown = 0;
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
  const lowerBound = pnlDistribution[Math.floor(iterations * 0.025)];
  const upperBound = pnlDistribution[Math.floor(iterations * 0.975)];
  return {
    meanPnl,
    stdDev,
    pnlDistribution,
    worstDrawdown,
    confidenceInterval: { lower: lowerBound, upper: upperBound },
  };
}
export function optimizeParams(
  baseStrategy: Strategy,
  paramRanges: { [key: string]: number[] },
  candles: Candle[]
): Strategy {
  let bestStrategy = baseStrategy;
  let bestProfitFactor = -Infinity;
  const paramKeys = Object.keys(paramRanges);
  const combinations = paramKeys.reduce((acc, key) => {
    const newAcc: any[] = [];
    acc.forEach(existingCombo => {
      paramRanges[key].forEach(value => {
        newAcc.push({ ...existingCombo, [key]: value });
      });
    });
    return newAcc;
  }, [{}]);
  for (const params of combinations) {
    const currentStrategy = { ...baseStrategy, params };
    const result = runBacktest(currentStrategy, candles);
    if (result.metrics.profitFactor > bestProfitFactor) {
      bestProfitFactor = result.metrics.profitFactor;
      bestStrategy = currentStrategy;
    }
  }
  return bestStrategy;
}
export function parseCsvData(csvString: string): Candle[] {
  const rows = csvString.trim().split('\n').slice(1); // Skip header
  return rows.map(row => {
    const [timestamp, open, high, low, close, volume] = row.split(',');
    return {
      timestamp: new Date(timestamp).getTime(),
      open: parseFloat(open),
      high: parseFloat(high),
      low: parseFloat(low),
      close: parseFloat(close),
      volume: parseFloat(volume),
    };
  }).filter(c => !isNaN(c.timestamp) && !isNaN(c.close));
}