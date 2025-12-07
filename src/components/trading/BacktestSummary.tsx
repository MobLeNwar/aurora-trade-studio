import React from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowUp, ArrowDown, Percent, Hash, Target, TrendingDown } from 'lucide-react';
import { BacktestMetrics } from '@/lib/trading';
interface BacktestSummaryProps {
  metrics: BacktestMetrics;
}
const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;
const formatCurrency = (value: number) => `$${value.toFixed(2)}`;
const formatNumber = (value: number) => value.toFixed(2);
const MetricCard = ({ title, value, icon, isPositive, isPercentage = false, isCurrency = false, delay = 0 }: { title: string; value: number; icon: React.ReactNode; isPositive?: boolean; isPercentage?: boolean; isCurrency?: boolean; delay?: number }) => {
  const formattedValue = isPercentage ? formatPercent(value) : isCurrency ? formatCurrency(value) : formatNumber(value);
  const colorClass = isPositive === undefined ? 'text-foreground' : isPositive ? 'text-green-500' : 'text-red-500';
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
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
export function BacktestSummary({ metrics }: BacktestSummaryProps) {
  const summaryMetrics = [
    { title: 'Net Profit', value: metrics.netProfit, icon: metrics.netProfit >= 0 ? <ArrowUp className="h-4 w-4 text-muted-foreground" /> : <ArrowDown className="h-4 w-4 text-muted-foreground" />, isPositive: metrics.netProfit >= 0, isCurrency: true },
    { title: 'Win Rate', value: metrics.winRate, icon: <Target className="h-4 w-4 text-muted-foreground" />, isPositive: metrics.winRate > 0.5, isPercentage: true },
    { title: 'Total Trades', value: metrics.totalTrades, icon: <Hash className="h-4 w-4 text-muted-foreground" /> },
    { title: 'Profit Factor', value: metrics.profitFactor, icon: <Percent className="h-4 w-4 text-muted-foreground" />, isPositive: metrics.profitFactor > 1 },
    { title: 'Max Drawdown', value: metrics.maxDrawdown, icon: <TrendingDown className="h-4 w-4 text-muted-foreground" />, isPositive: false, isPercentage: true },
  ];
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {summaryMetrics.map((metric, index) => (
        <MetricCard key={metric.title} {...metric} delay={index * 0.05} />
      ))}
    </div>
  );
}