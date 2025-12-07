import React, { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, Brush } from 'recharts';
import { AnimatePresence, motion } from 'framer-motion';
import { Zap, Bot, Settings, Maximize, Download, Upload, TestTube2, BrainCircuit } from 'lucide-react';
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
import { runBacktest, runMonteCarlo, optimizeParams, BacktestResult, Strategy, Candle, MonteCarloResult } from '@/lib/trading';
import sampleData from './TradingSimulatorData.json';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Toaster, toast } from 'sonner';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
const initialStrategy: Strategy = {
  type: 'sma-cross',
  params: { shortPeriod: 10, longPeriod: 20 },
  risk: { positionSizePercent: 100, stopLossPercent: 2, slippagePercent: 0.05, feePercent: 0.1 },
};
export default function TradingDashboard() {
  const [strategy, setStrategy] = useState<Strategy>(initialStrategy);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [monteCarloResult, setMonteCarloResult] = useState<MonteCarloResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [candles, setCandles] = useState<Candle[]>(sampleData as Candle[]);
  const handleRunBacktest = (currentStrategy: Strategy) => {
    setIsLoading(true);
    setMonteCarloResult(null);
    toast.info('Running backtest...', { description: 'Please wait while we process the strategy.' });
    setTimeout(() => {
      try {
        const result = runBacktest(currentStrategy, candles);
        setBacktestResult(result);
        toast.success('Backtest complete!', {
          description: `Analyzed ${result.trades.length} trades.`,
          action: { label: 'Run Monte Carlo', onClick: () => handleRunMonteCarlo(result) },
        });
      } catch (error) {
        console.error("Backtest failed:", error);
        toast.error('Backtest Failed', { description: 'An error occurred during the simulation.' });
      } finally {
        setIsLoading(false);
      }
    }, 50);
  };
  const handleRunMonteCarlo = (result: BacktestResult) => {
    toast.info('Running Monte Carlo simulation...');
    setTimeout(() => {
      const mcResult = runMonteCarlo(result, 1000);
      setMonteCarloResult(mcResult);
      toast.success('Monte Carlo simulation finished.');
    }, 50);
  };
  const handleOptimize = () => {
    setIsOptimizing(true);
    toast.info('Optimizing strategy parameters...');
    setTimeout(() => {
      const paramRanges = { shortPeriod: [5, 10, 15], longPeriod: [20, 30, 40] };
      const bestStrategy = optimizeParams(strategy, paramRanges, candles);
      setStrategy(bestStrategy);
      toast.success('Optimization Complete', { description: `Found best params: Short ${bestStrategy.params.shortPeriod}, Long ${bestStrategy.params.longPeriod}` });
      setIsOptimizing(false);
      handleRunBacktest(bestStrategy);
    }, 50);
  };
  const exportResults = (format: 'json' | 'csv') => {
    if (!backtestResult) {
      toast.error('No backtest data to export.');
      return;
    }
    if (format === 'json') {
      const dataStr = JSON.stringify(backtestResult, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'backtest_results.json';
      link.click();
      URL.revokeObjectURL(url);
    } else {
      const header = Object.keys(backtestResult.trades[0]).join(',');
      const csv = backtestResult.trades.map(row => Object.values(row).join(',')).join('\n');
      const dataStr = `${header}\n${csv}`;
      const blob = new Blob([dataStr], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'backtest_trades.csv';
      link.click();
      URL.revokeObjectURL(url);
    }
    toast.success(`Results exported as ${format.toUpperCase()}`);
  };
  const priceAndIndicatorData = useMemo(() => {
    if (!backtestResult) return [];
    return candles.map((c, i) => ({
      ...c,
      date: new Date(c.timestamp).toLocaleDateString(),
      price: c.close,
      smaShort: backtestResult.indicatorSeries.smaShort?.[i],
      smaLong: backtestResult.indicatorSeries.smaLong?.[i],
      rsi: backtestResult.indicatorSeries.rsi?.[i],
    }));
  }, [backtestResult, candles]);
  return (
    <div className="min-h-screen bg-muted/30 dark:bg-background/50">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/80 backdrop-blur-lg px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#F38020] to-[#4F46E5] flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-lg font-bold font-display hidden sm:block">Aurora</h1>
        </Link>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => exportResults('json')} disabled={!backtestResult}><Download className="w-4 h-4 mr-2" /> JSON</Button>
        <Button variant="outline" size="sm" onClick={() => exportResults('csv')} disabled={!backtestResult}><Download className="w-4 h-4 mr-2" /> CSV</Button>
        <ThemeToggle className="relative top-0 right-0" />
      </header>
      <div className="max-w-8xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-8 md:py-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <main className="lg:col-span-8 space-y-6">
              <CsvUploader onDataLoaded={setCandles} />
              <AnimatePresence>
                {backtestResult && (
                  <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                    <BacktestSummary metrics={backtestResult.metrics} />
                  </motion.div>
                )}
              </AnimatePresence>
              <Card className="shadow-soft rounded-2xl overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Performance</CardTitle>
                  <Dialog>
                    <DialogTrigger asChild><Button variant="ghost" size="icon"><Maximize className="w-4 h-4" /></Button></DialogTrigger>
                    <DialogContent className="max-w-7xl h-[80vh]">
                      <DialogHeader><DialogTitle>Performance Chart</DialogTitle></DialogHeader>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={backtestResult?.equityCurve}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={['dataMin', 'dataMax']} />
                          <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} />
                          <Area type="monotone" dataKey="value" stroke="#F38020" fill="#F38020" fillOpacity={0.2} name="Equity" />
                          <Brush dataKey="date" height={30} stroke="#F38020" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent className="h-[400px] p-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={backtestResult?.equityCurve}>
                      <defs><linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#F38020" stopOpacity={0.8}/><stop offset="95%" stopColor="#F38020" stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} domain={['dataMin', 'dataMax']} />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }} />
                      <Area type="monotone" dataKey="value" stroke="#F38020" fillOpacity={1} fill="url(#colorEquity)" name="Equity" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Tabs defaultValue="trades">
                <TabsList>
                  <TabsTrigger value="trades">Trades</TabsTrigger>
                  <TabsTrigger value="chart">Price Chart</TabsTrigger>
                  <TabsTrigger value="monte-carlo" disabled={!backtestResult}>Monte Carlo</TabsTrigger>
                  <TabsTrigger value="paper-trading">Paper Trading</TabsTrigger>
                  <TabsTrigger value="library">Library</TabsTrigger>
                </TabsList>
                <TabsContent value="trades"><TradeTable trades={backtestResult?.trades || []} /></TabsContent>
                <TabsContent value="chart">
                   <Card className="shadow-soft rounded-2xl"><CardContent className="h-[400px] pt-6">
                       <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={priceAndIndicatorData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} />
                          <Legend />
                          <Area yAxisId="left" type="monotone" dataKey="price" stroke="#8884d8" fill="#8884d8" fillOpacity={0.1} name="Price" />
                          <Area yAxisId="left" type="monotone" dataKey="smaShort" stroke="#82ca9d" fill="none" name="SMA Short" dot={false} />
                          <Area yAxisId="left" type="monotone" dataKey="smaLong" stroke="#ffc658" fill="none" name="SMA Long" dot={false} />
                          <Area yAxisId="right" type="monotone" dataKey="rsi" stroke="#ff7300" fill="none" name="RSI" dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent></Card>
                </TabsContent>
                <TabsContent value="monte-carlo">
                  {monteCarloResult ? (
                    <Card className="shadow-soft rounded-2xl"><CardContent className="h-[400px] pt-6">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monteCarloResult.pnlDistribution.map((pnl, i) => ({ name: i, pnl }))}>
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="pnl" fill="#4F46E5" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent></Card>
                  ) : <div className="text-center p-8">Run a backtest, then click "Run Monte Carlo" to see stress test results.</div>}
                </TabsContent>
                <TabsContent value="paper-trading"><PaperTradingMonitor /></TabsContent>
                <TabsContent value="library"><StrategyLibrary currentStrategy={strategy} onLoadStrategy={setStrategy} /></TabsContent>
              </Tabs>
            </main>
            <aside className="lg:col-span-4 space-y-6">
              <Tabs defaultValue="strategy" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="strategy"><Settings className="w-4 h-4 mr-2" />Strategy</TabsTrigger>
                  <TabsTrigger value="ai-explorer"><Bot className="w-4 h-4 mr-2" />AI Explorer</TabsTrigger>
                </TabsList>
                <TabsContent value="strategy">
                  <StrategyCard strategy={strategy} onStrategyChange={setStrategy} onRunBacktest={handleRunBacktest} isLoading={isLoading} />
                  <Button onClick={handleOptimize} disabled={isOptimizing} className="w-full mt-4"><BrainCircuit className="w-4 h-4 mr-2" /> {isOptimizing ? 'Optimizing...' : 'Optimize Parameters'}</Button>
                </TabsContent>
                <TabsContent value="ai-explorer"><ChatAssistantWrapper strategy={strategy} backtestResult={backtestResult} /></TabsContent>
              </Tabs>
            </aside>
          </div>
        </div>
      </div>
      <Toaster />
    </div>
  );
}