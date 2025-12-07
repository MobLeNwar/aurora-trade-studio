import React, { useState, useMemo, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, BarChart, Bar, Brush } from 'recharts';
import { AnimatePresence, motion } from 'framer-motion';
import { Zap, Bot, Settings, Maximize, Download, Upload, TestTube2, BrainCircuit, Clock } from 'lucide-react';
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
  risk: { positionSizePercent: 100, stopLossPercent: 2, slippagePercent: 0.05, feePercent: 0.1, trailingStopPercent: 0 },
};
export default function TradingDashboard() {
  const [strategy, setStrategy] = useState<Strategy>(initialStrategy);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [monteCarloResult, setMonteCarloResult] = useState<MonteCarloResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isAutoBacktesting, setIsAutoBacktesting] = useState(false);
  const [candles, setCandles] = useState<Candle[]>(sampleData as Candle[]);
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isAutoBacktesting) {
      interval = setInterval(() => handleRunBacktest(strategy), 60000);
      toast.info("Automated backtesting scheduled every 60 seconds.");
    }
    return () => clearInterval(interval);
  }, [isAutoBacktesting, strategy]);
  const handleRunBacktest = (currentStrategy: Strategy) => {
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
      } catch (error) {
        toast.error('Backtest Failed');
      } finally {
        setIsLoading(false);
      }
    }, 50);
  };
  const handleOptimize = () => {
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
  const exportResults = (format: 'json' | 'csv') => {
    if (!backtestResult) return toast.error('No backtest data to export.');
    const dataStr = format === 'json'
      ? JSON.stringify(backtestResult, null, 2)
      : `entryTime,exitTime,entryPrice,exitPrice,pnl,pnlPercent,type\n` + backtestResult.trades.map(t => Object.values(t).join(',')).join('\n');
    const blob = new Blob([dataStr], { type: format === 'json' ? 'application/json' : 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `backtest_results.${format}`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success(`Results exported as ${format.toUpperCase()}`);
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <main className="lg:col-span-8 space-y-6">
            <CsvUploader onDataLoaded={setCandles} />
            <AnimatePresence>{backtestResult && <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}><BacktestSummary metrics={backtestResult.metrics} /></motion.div>}</AnimatePresence>
            <Card className="shadow-soft rounded-2xl overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between"><CardTitle>Performance</CardTitle></CardHeader>
              <CardContent className="h-[400px] p-0">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={backtestResult?.equityCurve ?? []}>
                    <defs>
                      <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F38020" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#F38020" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} domain={['dataMin', 'dataMax']} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)' }} />
                    <Area type="monotone" dataKey="value" stroke="#F38020" fillOpacity={1} fill="url(#colorEquity)" name="Equity" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Tabs defaultValue="trades"><TabsList><TabsTrigger value="trades">Trades</TabsTrigger><TabsTrigger value="paper-trading">Paper Trading</TabsTrigger><TabsTrigger value="library">Library</TabsTrigger></TabsList>
              <AnimatePresence mode="wait">
                <motion.div key="trades" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><TabsContent value="trades"><TradeTable trades={backtestResult?.trades || []} /></TabsContent></motion.div>
                <motion.div key="paper-trading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><TabsContent value="paper-trading"><PaperTradingMonitor /></TabsContent></motion.div>
                <motion.div key="library" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><TabsContent value="library"><StrategyLibrary currentStrategy={strategy} onLoadStrategy={setStrategy} /></TabsContent></motion.div>
              </AnimatePresence>
            </Tabs>
          </main>
          <aside className="lg:col-span-4 space-y-6">
            <Tabs defaultValue="strategy" className="w-full"><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="strategy"><Settings className="w-4 h-4 mr-2" />Strategy</TabsTrigger><TabsTrigger value="ai-explorer"><Bot className="w-4 h-4 mr-2" />AI Explorer</TabsTrigger></TabsList>
              <TabsContent value="strategy"><StrategyCard strategy={strategy} onStrategyChange={setStrategy} onRunBacktest={handleRunBacktest} isLoading={isLoading} /><Button onClick={handleOptimize} disabled={isOptimizing} className="w-full mt-4"><BrainCircuit className="w-4 h-4 mr-2" /> {isOptimizing ? 'Optimizing...' : 'Optimize Parameters'}</Button><Button onClick={() => setIsAutoBacktesting(!isAutoBacktesting)} variant="outline" className="w-full mt-2"><Clock className="w-4 h-4 mr-2" /> {isAutoBacktesting ? 'Stop Scheduler' : 'Schedule Backtests'}</Button></TabsContent>
              <TabsContent value="ai-explorer"><ChatAssistantWrapper strategy={strategy} backtestResult={backtestResult} /></TabsContent>
            </Tabs>
          </aside>
        </div>
      </div></div>
      <Toaster />
    </div>
  );
}