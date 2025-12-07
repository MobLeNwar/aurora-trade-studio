import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, TrendingUp, RefreshCw, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { toast } from 'sonner';
import { fetchLivePrice } from '@/lib/trading';
import { Alpaca } from '@alpacahq/alpaca-trade-api';
interface Fill { timestamp: number; price: number; size: number; side: 'buy' | 'sell'; }
interface Position { entryPrice: number; size: number; pnl: number; peakPrice: number; }
interface PaperTradingMonitorProps { symbol: string; exchange: string; }
export function PaperTradingMonitor({ symbol, exchange }: PaperTradingMonitorProps) {
  const [isActive, setIsActive] = useState(false);
  const [fills, setFills] = useState<Fill[]>([]);
  const [position, setPosition] = useState<Position | null>(null);
  const [pnlHistory, setPnlHistory] = useState<{ time: number; pnl: number }[]>([]);
  const [isAlpacaConfigured, setIsAlpacaConfigured] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPrice = useRef(0);
  useEffect(() => {
    const checkConfig = async () => {
      try {
        const res = await fetch('/api/alpaca-config');
        const data = await res.json();
        if (data.success && data.data.configured) {
          setIsAlpacaConfigured(true);
          toast.success("Alpaca paper trading is configured.");
        } else {
          toast.warning("Alpaca not configured. Using mock simulation.", {
            description: "Set ALPACA_API_KEY and ALPACA_SECRET_KEY in your Worker secrets to enable real paper trading."
          });
        }
      } catch (error) {
        console.error("Failed to check Alpaca config:", error);
      }
    };
    checkConfig();
  }, []);
  const updatePriceAndPosition = useCallback(async () => {
    try {
      const newPrice = await fetchLivePrice({ exchange, symbol });
      if (newPrice === null) return;
      lastPrice.current = newPrice;
      if (position?.entryPrice) {
        const newPnl = (newPrice - position.entryPrice) * (position.size || 1);
        setPosition(p => p ? { ...p, pnl: newPnl } : null);
        setPnlHistory(prev => [...prev.slice(-99), { time: Date.now(), pnl: newPnl }]);
      }
    } catch (e) {
      console.warn('Polling error:', e);
    }
  }, [exchange, symbol, position]);
  useEffect(() => {
    if (isActive) {
      intervalRef.current = setInterval(updatePriceAndPosition, 5000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, updatePriceAndPosition]);
  const resetSimulation = () => {
    setIsActive(false);
    setFills([]);
    setPosition(null);
    setPnlHistory([]);
    lastPrice.current = 0;
    toast.info("Paper trading simulation has been reset.");
  };
  const placeOrder = (side: 'buy' | 'sell') => {
    if (!isActive) {
      toast.info("Start the monitor to place trades.");
      return;
    }
    if (!isAlpacaConfigured) {
      const price = lastPrice.current || 100;
      const newFill: Fill = { timestamp: Date.now(), price, size: 1, side };
      setFills(prev => [newFill, ...prev.slice(0, 49)]);
      setPosition({ entryPrice: price, size: 1, pnl: 0, peakPrice: price });
      setPnlHistory([{ time: Date.now(), pnl: 0 }]);
      toast.success(`Mock ${side} order filled at ${price.toFixed(2)}`);
      return;
    }
    toast.info(`Placing real paper trade via Alpaca for ${side} ${symbol}... (Not implemented)`);
  };
  return (
    <div className="space-y-6">
      {!isAlpacaConfigured && (
        <div className="flex items-center gap-3 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4 text-yellow-700 dark:text-yellow-300">
          <AlertTriangle className="h-5 w-5" />
          <p className="text-sm">You are in mock simulation mode. For real paper trading, configure your Alpaca API keys in settings.</p>
        </div>
      )}
      <Card className="shadow-soft rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Live Monitor</CardTitle>
          <div className="flex items-center gap-2">
            <Button onClick={() => setIsActive(!isActive)} size="sm" className="hover:scale-105 active:scale-95 transition-transform">
              {isActive ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
              {isActive ? 'Pause' : 'Start'}
            </Button>
            <Button onClick={resetSimulation} size="sm" variant="outline" className="hover:scale-105 active:scale-95 transition-transform"><RefreshCw className="w-4 h-4 mr-2" /> Reset</Button>
          </div>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base font-medium flex items-center gap-2 text-muted-foreground"><TrendingUp className="w-5 h-5" /> Current Position</CardTitle></CardHeader>
              <CardContent>
                {position ? (
                  <>
                    <div className={`text-3xl font-bold ${position.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>${position.pnl.toFixed(2)}</div>
                    <p className="text-sm text-muted-foreground">Entry: ${position.entryPrice.toFixed(2)} | Size: {position.size}</p>
                  </>
                ) : <p className="text-muted-foreground">No active position.</p>}
              </CardContent>
            </Card>
            <div className="h-[200px] md:h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pnlHistory}>
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} />
                  <YAxis domain={['auto', 'auto']} hide /><XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} hide />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <Line type="monotone" dataKey="pnl" stroke={position && position.pnl >= 0 ? '#22c55e' : '#ef4444'} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => placeOrder('buy')} className="w-full bg-green-600 hover:bg-green-700 hover:scale-105 active:scale-95 transition-all">Market Buy</Button>
              <Button onClick={() => placeOrder('sell')} className="w-full bg-red-600 hover:bg-red-700 hover:scale-105 active:scale-95 transition-all">Market Sell</Button>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">Fill History</h3>
            <Card className="h-80 overflow-y-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Side</TableHead><TableHead className="text-right">Price</TableHead></TableRow></TableHeader>
                <TableBody>
                  {fills.map((fill) => (
                    <motion.tr key={fill.timestamp} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
                      <TableCell>{new Date(fill.timestamp).toLocaleTimeString()}</TableCell>
                      <TableCell><Badge variant={fill.side === 'buy' ? 'default' : 'destructive'} className={fill.side === 'buy' ? 'bg-green-500/20 text-green-700' : 'bg-red-500/20 text-red-700'}>{fill.side}</Badge></TableCell>
                      <TableCell className="text-right">${fill.price.toFixed(2)}</TableCell>
                    </motion.tr>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}