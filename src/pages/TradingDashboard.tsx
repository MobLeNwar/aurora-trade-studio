import React, { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AnimatePresence, motion } from 'framer-motion';
import { Zap, Bot, Settings, BrainCircuit, Clock, Loader2, Download } from 'lucide-react';
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
import { runBacktest, optimizeParams, BacktestResult, Strategy, Candle, MonteCarloResult, fetchHistoricalData, runMonteCarlo } from '@/lib/trading';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Toaster, toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorBoundary } from 'react-error-boundary';
const initialStrategy: Strategy = {
  type: 'sma-cross',
  params: { shortPeriod: 10, longPeriod: 20 },
  risk: { positionSizePercent: 100, stopLossPercent: 2, slippagePercent: 0.05, feePercent: 0.1, trailingStopPercent: 0 },
};
function ErrorFallback({ error, resetErrorBoundary }: { error: Error, resetErrorBoundary: () => void }) {
  return (
    <div role="alert" className="p-8 text-center bg-destructive/10 rounded-lg">
      <h2 className="text-lg font-semibold text-destructive-foreground">Something went wrong</h2>
      <pre className="text-sm my-4">{error.message}</pre>
      <Button onClick={resetErrorBoundary}>Try again</Button>
    </div>
  );
}
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
  const handleRunBacktest = useCallback((currentStrategy: Strategy) => {
    if (candles.length === 0) {
      toast.error("No historical data available to run a backtest.");
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
        if (data) {
          setCandles(data);
          toast.success(`Loaded ${data.length} candles for ${symbol}.`);
        } else {
          toast.error(`Failed to fetch data for ${symbol}.`);
        }
      } catch (error) {
        console.warn('Data fetch error:', error);
        toast.error('Failed to fetch data', { description: 'Could not retrieve market data.' });
      }
      setIsFetchingData(false);
    };
    loadData();
  }, [symbol, exchange]);
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAutoBacktesting) {
      interval = setInterval(() => handleRunBacktest(strategy), 60000);
      toast.info("Automated backtesting scheduled every 60 seconds.");
    }
    return () => clearInterval(interval);
  }, [isAutoBacktesting, strategy, handleRunBacktest]);
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
  return (
    <div className="min-h-screen bg-muted/30 dark:bg-background/50">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/80 backdrop-blur-lg px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2"><div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#F38020] to-[#4F46E5] flex items-center justify-center"><Zap className="w-4 h-4 text-white" /></div><h1 className="text-lg font-bold font-display hidden sm:block">Aurora</h1></Link>
        <div className="flex-1" />
        <Button variant="ghost" asChild><Link to="/settings"><Settings className="w-4 h-4 mr-2" />Settings</Link></Button>
        <ThemeToggle className="relative top-0 right-0" />
      </header>
      <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8"><div className="py-8 md:py-10">
        <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => window.location.reload()}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <main className="lg:col-span-8 space-y-6">
              <Card className="shadow-soft rounded-2xl">
                <CardHeader><CardTitle>Market Data</CardTitle></CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1"><Select value={exchange} onValueChange={setExchange}><SelectTrigger><SelectValue placeholder="Select Exchange" /></SelectTrigger><SelectContent><SelectItem value="binance">Binance</SelectItem><SelectItem value="coinbasepro">Coinbase Pro</SelectItem><SelectItem value="kraken">Kraken</SelectItem></SelectContent></Select></div>
                  <div className="flex-1"><Select value={symbol} onValueChange={setSymbol}><SelectTrigger><SelectValue placeholder="Select Symbol" /></SelectTrigger><SelectContent><SelectItem value="BTC/USDT">BTC/USDT</SelectItem><SelectItem value="ETH/USDT">ETH/USDT</SelectItem><SelectItem value="SOL/USDT">SOL/USDT</SelectItem></SelectContent></Select></div>
                  <CsvUploader onDataLoaded={setCandles} />
                </CardContent>
              </Card>
              <AnimatePresence>{backtestResult && <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}><BacktestSummary metrics={backtestResult.metrics} monteCarlo={monteCarloResult} /></motion.div>}</AnimatePresence>
              <Card className="shadow-soft rounded-2xl overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between"><CardTitle>Performance</CardTitle><div className="flex items-center gap-2">{isFetchingData && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}<Button variant="outline" size="sm" onClick={handleExport} disabled={!backtestResult}><Download className="w-4 h-4 mr-2" /> Export</Button></div></CardHeader>
                <CardContent className="h-[400px] p-0">
                  {isFetchingData ? <Skeleton className="w-full h-full" /> :
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={backtestResult?.equityCurve ?? []}>
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
              <Tabs defaultValue="trades" value={activeTab} onValueChange={setActiveTab} role="tablist" aria-label="Trading views"><TabsList><TabsTrigger value="trades">Trades</TabsTrigger><TabsTrigger value="paper-trading">Paper Trading</TabsTrigger><TabsTrigger value="library">Library</TabsTrigger></TabsList>
                <AnimatePresence mode="wait">
                  <motion.div key={activeTab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
                    <TabsContent value="trades" forceMount={activeTab === 'trades'} className={activeTab !== 'trades' ? 'hidden' : ''}><TradeTable trades={backtestResult?.trades || []} /></TabsContent>
                    <TabsContent value="paper-trading" forceMount={activeTab === 'paper-trading'} className={activeTab !== 'paper-trading' ? 'hidden' : ''}><PaperTradingMonitor symbol={symbol} exchange={exchange} /></TabsContent>
                    <TabsContent value="library" forceMount={activeTab === 'library'} className={activeTab !== 'library' ? 'hidden' : ''}><StrategyLibrary currentStrategy={strategy} onLoadStrategy={setStrategy} /></TabsContent>
                  </motion.div>
                </AnimatePresence>
              </Tabs>
            </main>
            <aside className="lg:col-span-4 space-y-6">
              <Tabs defaultValue="strategy" className="w-full"><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="strategy"><Settings className="w-4 h-4 mr-2" />Strategy</TabsTrigger><TabsTrigger value="ai-explorer"><Bot className="w-4 h-4 mr-2" />AI Explorer</TabsTrigger></TabsList>
                <TabsContent value="strategy" asChild><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><StrategyCard strategy={strategy} onStrategyChange={setStrategy} onRunBacktest={handleRunBacktest} isLoading={isLoading} /><Button onClick={handleOptimize} disabled={isOptimizing} className="w-full mt-4"><BrainCircuit className="w-4 h-4 mr-2" /> {isOptimizing ? 'Optimizing...' : 'Optimize Parameters'}</Button><Button onClick={() => setIsAutoBacktesting(!isAutoBacktesting)} variant="outline" className="w-full mt-2"><Clock className="w-4 h-4 mr-2" /> {isAutoBacktesting ? 'Stop Scheduler' : 'Schedule Backtests'}</Button></motion.div></TabsContent>
                <TabsContent value="ai-explorer" asChild><motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}><ChatAssistantWrapper strategy={strategy} backtestResult={backtestResult} /></motion.div></TabsContent>
              </Tabs>
            </aside>
          </div>
        </ErrorBoundary>
      </div></div>
      <Toaster />
    </div>
  );
}