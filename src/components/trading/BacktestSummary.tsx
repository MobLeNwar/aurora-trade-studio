import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUp, ArrowDown, Percent, Hash, Target, TrendingDown, AlertTriangle, TrendingUp as TrendingUpIcon, Bot } from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { BacktestMetrics, MonteCarloResult } from '@/lib/trading';
import { Badge } from '@/components/ui/badge';
interface BacktestSummaryProps {
  metrics: BacktestMetrics;
  monteCarlo?: MonteCarloResult | null;
  latestSignal?: { vote: string; confidence: number };
}
const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;
const formatCurrency = (value: number) => `${value.toFixed(2)}`;
const formatNumber = (value: number) => value.toFixed(2);
const metricCardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};
const MetricCard = ({ title, value, icon, isPositive, isPercentage = false, isCurrency = false }: { title: string; value: number; icon: React.ReactNode; isPositive?: boolean; isPercentage?: boolean; isCurrency?: boolean; }) => {
  const formattedValue = isPercentage ? formatPercent(value) : isCurrency ? formatCurrency(value) : formatNumber(value);
  const colorClass = isPositive === undefined ? 'text-foreground' : isPositive ? 'text-green-500' : 'text-red-500';
  return (
    <motion.div variants={metricCardVariants}>
      <Card className="shadow-soft hover:shadow-md transition-shadow duration-300 border-border/80 rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          {icon}
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${colorClass}`}>{formattedValue}</div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
export function BacktestSummary({ metrics, monteCarlo, latestSignal }: BacktestSummaryProps) {
  const summaryMetrics = [
    { title: 'Net Profit', value: metrics.netProfit, icon: metrics.netProfit >= 0 ? <ArrowUp className="h-4 w-4 text-muted-foreground" /> : <ArrowDown className="h-4 w-4 text-muted-foreground" />, isPositive: metrics.netProfit >= 0, isCurrency: true },
    { title: 'Win Rate', value: metrics.winRate, icon: <Target className="h-4 w-4 text-muted-foreground" />, isPositive: metrics.winRate > 0.5, isPercentage: true },
    { title: 'Total Trades', value: metrics.totalTrades, icon: <Hash className="h-4 w-4 text-muted-foreground" /> },
    { title: 'Profit Factor', value: metrics.profitFactor, icon: <Percent className="h-4 w-4 text-muted-foreground" />, isPositive: metrics.profitFactor > 1 },
    { title: 'Max Drawdown', value: metrics.maxDrawdown, icon: <TrendingDown className="h-4 w-4 text-muted-foreground" />, isPositive: false, isPercentage: true },
  ];
  const mcMetrics = monteCarlo ? [
    { title: 'Mean PnL (MC)', value: monteCarlo.meanPnl, icon: <TrendingUpIcon className="h-4 w-4 text-muted-foreground" />, isPositive: monteCarlo.meanPnl >= 0, isCurrency: true },
    { title: 'Worst DD (MC)', value: monteCarlo.worstDrawdown, icon: <TrendingDown className="h-4 w-4 text-muted-foreground" />, isPositive: false, isPercentage: true },
    { title: 'VaR 95%', value: monteCarlo.var95, icon: <AlertTriangle className="h-4 w-4 text-muted-foreground" />, isPositive: false, isCurrency: true },
  ] : [];
  const pnlDistributionData = monteCarlo?.pnlDistribution
    ? Array.from(
        monteCarlo.pnlDistribution.reduce((map, pnl) => {
          const bin = Math.floor(pnl / 500) * 500;
          map.set(bin, (map.get(bin) || 0) + 1);
          return map;
        }, new Map<number, number>()),
        ([pnl, count]) => ({ pnl, count })
      ).sort((a, b) => a.pnl - b.pnl)
    : [];
  return (
    <div role="region" aria-label="Backtest metrics summary" className="space-y-4">
      <motion.div
        className="grid gap-4 md:grid-cols-3 lg:grid-cols-5"
        variants={{ visible: { transition: { staggerChildren: 0.05 } } }}
        initial="hidden"
        animate="visible"
      >
        {summaryMetrics.map((metric) => <MetricCard key={metric.title} {...metric} />)}
      </motion.div>
      <motion.div
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
        variants={{ visible: { transition: { staggerChildren: 0.05, delayChildren: 0.2 } } }}
        initial="hidden"
        animate="visible"
      >
        {monteCarlo ? mcMetrics.map((metric) => <MetricCard key={metric.title} {...metric} />) : Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        {latestSignal && (
          <motion.div variants={metricCardVariants}>
            <Card className="shadow-soft rounded-2xl h-full">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">AI Consensus</CardTitle>
                <Bot className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <Badge variant={latestSignal.vote === 'buy' ? 'default' : latestSignal.vote === 'sell' ? 'destructive' : 'secondary'} className={latestSignal.vote === 'buy' ? 'bg-green-500/20 text-green-700 dark:bg-green-500/10 dark:text-green-400' : latestSignal.vote === 'sell' ? 'bg-red-500/20 text-red-700 dark:bg-red-500/10 dark:text-red-400' : ''}>
                  {latestSignal.vote.toUpperCase()} ({latestSignal.confidence.toFixed(1)}%)
                </Badge>
              </CardContent>
            </Card>
          </motion.div>
        )}
        {monteCarlo && !latestSignal ? (
          <motion.div variants={metricCardVariants} className="md:col-span-2 lg:col-span-1">
            <Card className="shadow-soft rounded-2xl h-full">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">PnL Distribution</CardTitle></CardHeader>
              <CardContent className="h-20">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pnlDistributionData}>
                    <Bar dataKey="count" fill="hsl(var(--primary))" />
                    <XAxis dataKey="pnl" hide />
                    <YAxis hide />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </motion.div>
        ) : <Skeleton className="h-24 w-full" />}
      </motion.div>
    </div>
  );
}