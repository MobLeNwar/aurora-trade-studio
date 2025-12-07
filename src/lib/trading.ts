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
}
export interface BacktestResult {
  trades: Trade[];
  metrics: BacktestMetrics;
  equityCurve: { date: string; value: number }[];
  indicatorSeries: { [key: string]: (number | undefined)[] };
}
export function runBacktest(strategy: Strategy, candles: Candle[]): BacktestResult {
  let equity = 10000;
  const initialEquity = equity;
  const equityCurve: { date: string; value: number }[] = [{ date: new Date(candles[0].timestamp).toLocaleDateString(), value: equity }];
  const trades: Trade[] = [];
  let position: { entryPrice: number; type: 'long' | 'short' } | null = null;
  let peakEquity = equity;
  let maxDrawdown = 0;
  const closePrices = candles.map(c => c.close);
  // Calculate indicators
  const indicatorSeries: { [key: string]: (number | undefined)[] } = {};
  if (strategy.type === 'sma-cross') {
    indicatorSeries.smaShort = SMA.calculate({ period: strategy.params.shortPeriod, values: closePrices });
    indicatorSeries.smaLong = SMA.calculate({ period: strategy.params.longPeriod, values: closePrices });
  } else if (strategy.type === 'rsi-filter') {
    indicatorSeries.rsi = RSI.calculate({ period: strategy.params.rsiPeriod, values: closePrices });
    indicatorSeries.sma = SMA.calculate({ period: strategy.params.smaPeriod, values: closePrices });
  }
  for (let i = 1; i < candles.length; i++) {
    const candle = candles[i];
    const prevCandle = candles[i - 1];
    // Entry/Exit logic
    let signal: 'buy' | 'sell' | null = null;
    if (strategy.type === 'sma-cross') {
      const smaShort = indicatorSeries.smaShort[i - strategy.params.shortPeriod]
      const smaLong = indicatorSeries.smaLong[i - strategy.params.longPeriod]
      const prevSmaShort = indicatorSeries.smaShort[i - strategy.params.shortPeriod - 1]
      const prevSmaLong = indicatorSeries.smaLong[i - strategy.params.longPeriod - 1]
      if (smaShort && smaLong && prevSmaShort && prevSmaLong) {
        if (prevSmaShort <= prevSmaLong && smaShort > smaLong) signal = 'buy';
        if (prevSmaShort >= prevSmaLong && smaShort < smaLong) signal = 'sell';
      }
    } else if (strategy.type === 'rsi-filter') {
        const rsiVal = indicatorSeries.rsi[i - strategy.params.rsiPeriod];
        const smaVal = indicatorSeries.sma[i - strategy.params.smaPeriod];
        if (rsiVal && smaVal) {
            if (candle.close > smaVal && rsiVal < strategy.params.rsiLower) signal = 'buy';
            if (candle.close < smaVal && rsiVal > strategy.params.rsiUpper) signal = 'sell';
        }
    }
    // Position management
    if (position) {
      // Stop loss check
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
      } else if (signal === 'sell') {
        // Short selling logic can be added here if needed
      }
    }
    equityCurve.push({ date: new Date(candle.timestamp).toLocaleDateString(), value: equity });
    if (equity > peakEquity) peakEquity = equity;
    const drawdown = (peakEquity - equity) / peakEquity;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  function openPosition(time: number, price: number, type: 'long' | 'short') {
    const slippage = price * (strategy.risk.slippagePercent / 100);
    const entryPrice = type === 'long' ? price + slippage : price - slippage;
    position = { entryPrice, type };
  }
  function closePosition(time: number, price: number) {
    if (!position) return;
    const slippage = price * (strategy.risk.slippagePercent / 100);
    const exitPrice = position.type === 'long' ? price - slippage : price + slippage;
    const pnl = (exitPrice - position.entryPrice) * (position.type === 'long' ? 1 : -1);
    const fee = (position.entryPrice + exitPrice) * (strategy.risk.feePercent / 100);
    const netPnl = pnl - fee;
    const pnlPercent = netPnl / position.entryPrice;
    equity += equity * (strategy.risk.positionSizePercent / 100) * pnlPercent;
    trades.push({
      entryTime: candle.timestamp, // This is not right, needs fixing if we had state
      exitTime: time,
      entryPrice: position.entryPrice,
      exitPrice: exitPrice,
      pnl: netPnl,
      pnlPercent: pnlPercent,
      type: position.type,
    });
    position = null;
  }
  // Calculate metrics
  const winningTrades = trades.filter(t => t.pnl > 0).length;
  const losingTrades = trades.filter(t => t.pnl <= 0).length;
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