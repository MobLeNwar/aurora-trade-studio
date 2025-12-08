import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, ReferenceLine } from 'recharts';
import { AnimatePresence, motion } from 'framer-motion';
import { Zap, Bot, Settings, BrainCircuit, Clock, Loader2, Download, Play, Pause, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StrategyCard } from '@/components/trading/StrategyCard';
import { BacktestSummary } from '@/components/trading/BacktestSummary';
import { TradeTable } from '@/components/trading/TradeTable';
import { ChatAssistantWrapper } from '@/components/ui/ChatAssistantWrapper';
import { CsvUploader } from '@/components/trading/CsvUploader';
import { PaperTradingMonitor } from '@/components/trading/PaperTradingMonitor';
import { StrategyLibrary } from '@/components/trading/StrategyLibrary';
import { runBacktest, optimizeParams, BacktestResult, Strategy, Candle, MonteCarloResult, fetchHistoricalData, runMonteCarlo, bot, Signal, validateSignal } from '@/lib/trading';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Toaster, toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import fallbackCandlesData from '@/pages/TradingSimulatorData.json';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { RSI, MACD, SMA } from 'technicalindicators';
const initialStrategy: Strategy = {
  type: 'sma-cross',
  params: { shortPeriod: 10, longPeriod: 20 },
  risk: { positionSizePercent: 100, stopLossPercent: 2, slippagePercent: 0.05, feePercent: 0.1, trailingStopPercent: 0 },
};
type PaperTradingMonitorHandle = {
  placeOrder: (side: 'buy' | 'sell') => void;
};
export default function TradingDashboard() {
  const [strategy, setStrategy] = useState<Strategy>(initialStrategy);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [monteCarloResult, setMonteCarloResult] = useState<MonteCarloResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isAutoBacktesting, setIsAutoBacktesting] = useState(false);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [isFetchingData, setIsFetchingData] = useState(true);
  const [symbol, setSymbol] = useState(() => localStorage.getItem('trading-config-symbol') || 'BTC/USDT');
  const [exchange, setExchange] = useState(() => localStorage.getItem('trading-config-exchange') || 'binance');
  const [activeTab, setActiveTab] = useState('trades');
  const [signals, setSignals] = useState<Signal[]>([]);
  const [votes, setVotes] = useState({ buy: 0, sell: 0, hold: 0 });
  const [isBotActive, setIsBotActive] = useState(false);
  const monitorRef = useRef<PaperTradingMonitorHandle>(null);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [indicatorData, setIndicatorData] = useState<{ rsi: any[], macd: any[] }>({ rsi: [], macd: [] });
  const [regimes, setRegimes] = useState<{ [key: string]: string }>({});
  const handleRunBacktest = useCallback((currentStrategy: Strategy) => {
    if (candles.length === 0) {
      toast.error("No historical data available. Please upload CSV or wait for data to fetch.");
      return;
    }
    setIsLoading(true);
    setMonteCarloResult(null);
    toast.info('Running backtest...');
    setTimeout(() => {
      try {
        const result = runBacktest(currentStrategy, candles);
        setBacktestResult(result);
        if (result.metrics.maxDrawdown > 0.1) {
          toast.warning('High Drawdown Detected', { description: `Max drawdown is ${(result.metrics.maxDrawdown * 100).toFixed(2)}%` });
        }
        toast.success('Backtest complete!');
        if (result.trades.length > 10) {
          const mc = runMonteCarlo(result, 1000);
          setMonteCarloResult(mc);
          toast.info('Monte Carlo simulation complete.');
        }
      } catch (error) {
        toast.error('Backtest Failed', { description: error instanceof Error ? error.message : 'Unknown error' });
      } finally {
        setIsLoading(false);
      }
    }, 50);
  }, [candles]);
  useEffect(() => {
    const loadData = async () => {
      setIsFetchingData(true);
      toast.info(`Fetching historical data for ${symbol}...`);
      try {
        const data = await fetchHistoricalData({ symbol, exchange, limit: 500 });
        if (!data || data.length === 0) {
          const fallback: Candle[] = fallbackCandlesData;
          setCandles(fallback);
          toast.warning('No real-time data available. Using sample data for demonstration.', {
            description: 'Upload CSV or check connection for live data.',
          });
        } else {
          setCandles(data);
          toast.success(`Loaded ${data.length} candles for ${symbol}.`);
        }
      } catch (error) {
        console.warn('Data fetch error:', error);
        const fallback: Candle[] = fallbackCandlesData;
        setCandles(fallback);
        toast.error('Failed to fetch market data. Using sample fallback.', {
          description: 'Upload CSV for custom data or retry.',
        });
      } finally {
        setIsFetchingData(false);
      }
    };
    loadData();
  }, [symbol, exchange]);
  const loadTrends = useCallback(async () => {
    const tfs = ['1h', '4h', '1d'];
    const multiDataPromises = tfs.map(tf => fetchHistoricalData({ symbol, exchange, timeframe: tf, limit: 100 }));
    const allData = await Promise.all(multiDataPromises);
    const trendChartData: any[] = [];
    const newRegimes: { [key: string]: string } = {};
    allData.forEach((data, index) => {
      if (data && data.length > 0) {
        const tf = tfs[index];
        const closePrices = data.map(d => d.close);
        const sma = SMA.calculate({ period: 20, values: closePrices });
        const rsi = RSI.calculate({ period: 14, values: closePrices });
        const lastSma = sma[sma.length - 1];
        const lastRsi = rsi[rsi.length - 1];
        if (lastSma && lastRsi) {
          if (data[data.length - 1].close > lastSma && lastRsi > 50) newRegimes[tf] = 'bull';
          else if (data[data.length - 1].close < lastSma && lastRsi < 50) newRegimes[tf] = 'bear';
          else newRegimes[tf] = 'chop';
        }
        data.forEach((d, i) => {
          const existing = trendChartData.find(p => p.timestamp === d.timestamp);
          if (existing) {
            existing[`price${tf}`] = d.close;
          } else {
            trendChartData.push({ timestamp: d.timestamp, [`price${tf}`]: d.close });
          }
        });
      }
    });
    setRegimes(newRegimes);
    setTrendData(trendChartData.sort((a, b) => a.timestamp - b.timestamp));
    if (candles.length > 0) {
      const closePrices = candles.map(c => c.close);
      const rsiValues = RSI.calculate({ period: 14, values: closePrices });
      const macdValues = MACD.calculate({ values: closePrices, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false });
      setIndicatorData({
        rsi: candles.slice(-rsiValues.length).map((c, i) => ({ timestamp: c.timestamp, value: rsiValues[i] })),
        macd: candles.slice(-macdValues.length).map((c, i) => ({ timestamp: c.timestamp, ...macdValues[i] })),
      });
    }
  }, [symbol, exchange, candles]);
  useEffect(() => {
    if (activeTab === 'trends') {
      loadTrends();
    }
  }, [activeTab, loadTrends]);
  useEffect(() => {
    const handleSignal = (sig: Signal) => {
      setSignals(prev => [sig, ...prev.slice(0, 9)]);
      setVotes(prev => {
        const newVotes = { ...prev };
        if (sig.vote === 'buy' || sig.vote === 'sell' || sig.vote === 'hold') {
          newVotes[sig.vote]++;
        }
        return newVotes;
      });
      toast.success(`Autonomous Signal: ${sig.symbol} ${sig.vote.toUpperCase()}`, {
        description: `Confidence: ${sig.confidence.toFixed(1)}%`,
      });
      if (sig.confidence > 90 && (sig.vote === 'buy' || sig.vote === 'sell')) {
        monitorRef.current?.placeOrder(sig.vote);
        toast.info(`High-confidence signal detected. Auto-placing paper trade for ${sig.vote}.`);
      }
    };
    bot.on('signal', handleSignal);
    return () => { /* cleanup */ };
  }, []);
  useEffect(() => {
    if (isBotActive) {
      bot.start();
    } else {
      bot.stop();
    }
    return () => bot.stop();
  }, [isBotActive]);
  const handleOptimize = () => {
    if (candles.length === 0) {
      toast.error("No historical data available for optimization.");
      return;
    }
    setIsOptimizing(true);
    toast.info('Optimizing strategy parameters...');
    setTimeout(() => {
      const paramRanges = { shortPeriod: [5, 10, 15], longPeriod: [20, 30, 40], stopLossPercent: [1, 2, 3], trailingStopPercent: [1, 2, 3] };
      const bestStrategy = optimizeParams(strategy, paramRanges, candles);
      setStrategy(bestStrategy);
      toast.success('Optimization Complete', { description: `Found best params via Sharpe Ratio.` });
      setIsOptimizing(false);
      handleRunBacktest(bestStrategy);
    }, 50);
  };
  const handleExport = () => {
    if (!backtestResult) {
      toast.info("No backtest results to export.");
      return;
    }
    const exportData = { backtest: backtestResult, monteCarlo: monteCarloResult };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aurora-results-${symbol.replace('/', '_')}-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Results exported.");
  };
  const voteData = [{ name: 'Buy', value: votes.buy }, { name: 'Sell', value: votes.sell }, { name: 'Hold', value: votes.hold }];
  const VOTE_COLORS = ['#22c55e', '#ef4444', '#6b7280'];
  const getRegimeColor = (regime: string) => {
    if (regime === 'bull') return 'bg-green-500/20 text-green-700 dark:text-green-400';
    if (regime === 'bear') return 'bg-red-500/20 text-red-700 dark:text-red-400';
    return 'bg-gray-500/20 text-gray-700 dark:text-gray-400';
  };
  return (
    <div className="min-h-screen bg-muted/30 dark:bg-background/50">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/80 backdrop-blur-lg px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2"><div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#F38020] to-[#4F46E5] flex items-center justify-center"><Zap className="w-4 h-4 text-white" /></div><h1 className="text-lg font-bold font-display hidden sm:block">Aurora</h1></Link>
        <div className="flex-1" />
        <Button variant="ghost" asChild><Link to="/settings"><Settings className="w-4 h-4 mr-2" />Settings</Link></Button>
        <ThemeToggle className="relative top-0 right-0" />
      </header>
      <main>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-8 md:py-10 lg:py-12">
            <ErrorBoundary>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-8 space-y-6">
                  <Card className="shadow-soft rounded-2xl">
                    <CardHeader><CardTitle>Market Data</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="flex-1"><Select value={exchange} onValueChange={setExchange}><SelectTrigger><SelectValue placeholder="Select Exchange" /></SelectTrigger><SelectContent><SelectItem value="binance">Binance</SelectItem><SelectItem value="coinbasepro">Coinbase Pro</SelectItem><SelectItem value="kraken">Kraken</SelectItem></SelectContent></Select></div>
                      <div className="flex-1"><Select value={symbol} onValueChange={setSymbol}><SelectTrigger><SelectValue placeholder="Select Symbol" /></SelectTrigger><SelectContent><SelectItem value="BTC/USDT">BTC/USDT</SelectItem><SelectItem value="ETH/USDT">ETH/USDT</SelectItem><SelectItem value="SOL/USDT">SOL/USDT</SelectItem></SelectContent></Select></div>
                      <CsvUploader onDataLoaded={setCandles} />
                    </CardContent>
                  </Card>
                  <AnimatePresence>{backtestResult && <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}><BacktestSummary metrics={backtestResult.metrics} monteCarlo={monteCarloResult} latestSignal={signals[0]} /></motion.div>}</AnimatePresence>
                  <Card className="shadow-soft rounded-2xl overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between"><CardTitle>Performance</CardTitle><div className="flex items-center gap-2">{isFetchingData && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}<Button variant="outline" size="sm" onClick={handleExport} disabled={!backtestResult}><Download className="w-4 h-4 mr-2" /> Export</Button></div></CardHeader>
                    <CardContent className="h-[400px] p-0">
                      {isFetchingData ? <Skeleton className="w-full h-full" /> :
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={backtestResult?.equityCurve ?? candles.map((c, i) => ({ date: new Date(c.timestamp).toLocaleDateString(), value: 10000 + i * 10 }))}>
                          <defs><linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#F38020" stopOpacity={0.8}/><stop offset="95%" stopColor="#F38020" stopOpacity={0}/></linearGradient></defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} domain={['dataMin', 'dataMax']} />
                          <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }} />
                          <Area type="monotone" dataKey="value" stroke="#F38020" fillOpacity={1} fill="url(#colorEquity)" name="Equity" />
                        </AreaChart>
                      </ResponsiveContainer>}
                    </CardContent>
                  </Card>
                  <Tabs defaultValue="trades" value={activeTab} onValueChange={setActiveTab} role="tablist" aria-label="Trading views"><TabsList><TabsTrigger value="trades">Trades</TabsTrigger><TabsTrigger value="paper-trading">Paper Trading</TabsTrigger><TabsTrigger value="autonomous">Autonomous Bot</TabsTrigger><TabsTrigger value="trends">Trends View</TabsTrigger><TabsTrigger value="library">Library</TabsTrigger></TabsList>
                    <AnimatePresence mode="wait">
                      <motion.div key={activeTab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
                        <TabsContent value="trades" forceMount={activeTab === 'trades' ? true : undefined} className={activeTab !== 'trades' ? 'hidden' : ''}><TradeTable trades={backtestResult?.trades || []} /></TabsContent>
                        <TabsContent value="paper-trading" forceMount={activeTab === 'paper-trading' ? true : undefined} className={activeTab !== 'paper-trading' ? 'hidden' : ''}><PaperTradingMonitor ref={monitorRef} symbol={symbol} exchange={exchange} /></TabsContent>
                        <TabsContent value="autonomous" forceMount={activeTab === 'autonomous' ? true : undefined} className={activeTab !== 'autonomous' ? 'hidden' : ''}>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 mt-4">
                            <div className="lg:col-span-8 space-y-6">
                              <Card><CardHeader><CardTitle>Recent Autonomous Signals</CardTitle></CardHeader><CardContent><Table><TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Symbol</TableHead><TableHead>Vote</TableHead><TableHead>Confidence</TableHead><TableHead>Rationale</TableHead></TableRow></TableHeader><TableBody>{signals.length > 0 ? signals.map((sig, i) => (<motion.tr key={sig.timestamp} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}><TableCell>{new Date(sig.timestamp).toLocaleTimeString()}</TableCell><TableCell>{sig.symbol}</TableCell><TableCell><Badge variant={sig.vote === 'buy' ? 'default' : sig.vote === 'sell' ? 'destructive' : 'secondary'} className={sig.vote === 'buy' ? 'bg-green-500/20 text-green-700 dark:bg-green-500/10 dark:text-green-400' : sig.vote === 'sell' ? 'bg-red-500/20 text-red-700 dark:bg-red-500/10 dark:text-red-400' : ''}>{sig.vote.toUpperCase()}</Badge></TableCell><TableCell>{sig.confidence.toFixed(1)}%</TableCell><TableCell className="max-w-xs truncate" title={sig.rationale}>{sig.rationale}</TableCell></motion.tr>)) : <TableRow><TableCell colSpan={5} className="text-center h-24">No signals received yet. Start the bot to begin.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
                            </div>
                            <aside className="lg:col-span-4 space-y-6">
                              <Card><CardHeader><CardTitle>Bot Control</CardTitle></CardHeader><CardContent className="space-y-4"><Button onClick={() => setIsBotActive(true)} disabled={isBotActive} className="w-full"><Play className="w-4 h-4 mr-2" /> Start Scanner</Button><Button onClick={() => setIsBotActive(false)} disabled={!isBotActive} variant="outline" className="w-full"><Pause className="w-4 h-4 mr-2" /> Stop Scanner</Button><Button onClick={() => { if (signals[0]) { const metrics = validateSignal(strategy, signals[0], candles); toast.info(`Signal Validation: Win Rate is ${(metrics.winRate * 100).toFixed(1)}%`, { description: `This signal appears ${metrics.winRate > 0.5 ? 'strong' : 'weak'} against the current strategy.` }); } else { toast.info("No signal to validate."); } }} className="w-full" variant="secondary"><CheckCircle className="w-4 h-4 mr-2" /> Validate Latest Signal</Button></CardContent></Card>
                              <Card><CardHeader><CardTitle>Signal Distribution</CardTitle></CardHeader><CardContent className="h-[250px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={voteData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>{voteData.map((entry, index) => (<Cell key={`cell-${index}`} fill={VOTE_COLORS[index % VOTE_COLORS.length]} />))}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer></CardContent></Card>
                            </aside>
                          </div>
                        </TabsContent>
                        <TabsContent value="trends" forceMount={activeTab === 'trends' ? true : undefined} className={activeTab !== 'trends' ? 'hidden' : ''}>
                          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4">
                            <div className="lg:col-span-8 space-y-6">
                              <Card><CardHeader><CardTitle>Regime Analysis</CardTitle></CardHeader><CardContent><div className="grid grid-cols-1 md:grid-cols-3 gap-4">{['1h', '4h', '1d'].map((tf, i) => (<motion.div key={tf} initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: i * 0.1 }} className={`p-4 rounded-lg text-center ${getRegimeColor(regimes[tf] || 'chop')}`}><p className="font-bold text-lg">{tf.toUpperCase()}</p><p className="text-sm capitalize">{regimes[tf] || 'Calculating...'}</p></motion.div>))}</div></CardContent></Card>
                              <Card><CardHeader><CardTitle>RSI (14)</CardTitle></CardHeader><CardContent className="h-[200px] p-0"><ResponsiveContainer width="100%" height="100%"><AreaChart data={indicatorData.rsi}><defs><linearGradient id="colorRsi" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/><stop offset="95%" stopColor="#22c55e" stopOpacity={0}/></linearGradient></defs><Tooltip /><YAxis domain={[0, 100]} /><ReferenceLine y={70} stroke="red" strokeDasharray="3 3" /><ReferenceLine y={30} stroke="green" strokeDasharray="3 3" /><Area type="monotone" dataKey="value" stroke="#22c55e" fill="url(#colorRsi)" /></AreaChart></ResponsiveContainer></CardContent></Card>
                              <Card><CardHeader><CardTitle>MACD (12, 26, 9)</CardTitle></CardHeader><CardContent className="h-[200px] p-0"><ResponsiveContainer width="100%" height="100%"><LineChart data={indicatorData.macd}><Tooltip /><Line type="monotone" dataKey="MACD" stroke="#ef4444" dot={false} /><Line type="monotone" dataKey="signal" stroke="#f59e0b" dot={false} /><ReferenceLine y={0} stroke="hsl(var(--border))" /></LineChart></ResponsiveContainer></CardContent></Card>
                            </div>
                            <aside className="lg:col-span-4 space-y-6">
                              <Card><CardHeader><CardTitle>Multi-Timeframe Price</CardTitle></CardHeader><CardContent className="h-[300px] p-0"><ResponsiveContainer width="100%" height="100%"><LineChart data={trendData}><Tooltip /><XAxis dataKey="timestamp" tickFormatter={(ts) => new Date(ts).toLocaleDateString()} /><YAxis domain={['auto', 'auto']} /><Line type="monotone" dataKey="price1h" stroke="#F38020" name="1h" dot={false} /><Line type="monotone" dataKey="price4h" stroke="#4F46E5" name="4h" dot={false} /><Line type="monotone" dataKey="price1d" stroke="#06B6D4" name="1d" dot={false} /></LineChart></ResponsiveContainer></CardContent></Card>
                            </aside>
                          </div>
                        </TabsContent>
                        <TabsContent value="library" forceMount={activeTab === 'library' ? true : undefined} className={activeTab !== 'library' ? 'hidden' : ''}><StrategyLibrary currentStrategy={strategy} onLoadStrategy={setStrategy} /></TabsContent>
                      </motion.div>
                    </AnimatePresence>
                  </Tabs>
                </div>
                <aside className="lg:col-span-4 space-y-6">
                  <Tabs defaultValue="strategy" className="w-full"><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="strategy"><Settings className="w-4 h-4 mr-2" />Strategy</TabsTrigger><TabsTrigger value="ai-explorer"><Bot className="w-4 h-4 mr-2" />AI Explorer</TabsTrigger></TabsList>
                    <TabsContent value="strategy" asChild><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><StrategyCard strategy={strategy} onStrategyChange={setStrategy} onRunBacktest={handleRunBacktest} isLoading={isLoading} /><Button onClick={handleOptimize} disabled={isOptimizing} className="w-full mt-4"><BrainCircuit className="w-4 h-4 mr-2" /> {isOptimizing ? 'Optimizing...' : 'Optimize Parameters'}</Button><Button onClick={() => setIsAutoBacktesting(!isAutoBacktesting)} variant="outline" className="w-full mt-2"><Clock className="w-4 h-4 mr-2" /> {isAutoBacktesting ? 'Stop Scheduler' : 'Schedule Backtests'}</Button></motion.div></TabsContent>
                    <TabsContent value="ai-explorer" asChild><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><ChatAssistantWrapper strategy={strategy} backtestResult={backtestResult} /></motion.div></TabsContent>
                  </Tabs>
                </aside>
              </div>
            </ErrorBoundary>
          </div>
        </div>
      </main>
      <Toaster />
    </div>
  );
}