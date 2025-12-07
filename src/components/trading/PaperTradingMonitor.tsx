import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, TrendingUp, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { toast } from 'sonner';
interface Fill {
  timestamp: number;
  price: number;
  size: number;
  side: 'buy' | 'sell';
}
interface Position {
  entryPrice: number;
  size: number;
  pnl: number;
  peakPrice: number;
}
interface Order {
  id: string;
  price: number;
  side: 'buy' | 'sell';
  type: 'limit' | 'market';
}
export function PaperTradingMonitor() {
  const [isActive, setIsActive] = useState(false);
  const [fills, setFills] = useState<Fill[]>([]);
  const [position, setPosition] = useState<Position | null>(null);
  const [pnlHistory, setPnlHistory] = useState<{ time: number; pnl: number }[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPrice = useRef(112.0);
  const trailingStopPercent = 2; // Example: 2% trailing stop
  const resetSimulation = () => {
    setIsActive(false);
    setFills([]);
    setPosition(null);
    setPnlHistory([]);
    setOrders([]);
    lastPrice.current = 112.0;
    toast.info("Paper trading simulation has been reset.");
  };
  useEffect(() => {
    if (isActive) {
      intervalRef.current = setInterval(() => {
        const priceChange = (Math.random() - 0.5) * 0.5;
        const newPrice = Math.max(100, lastPrice.current + priceChange);
        lastPrice.current = newPrice;
        // Process pending orders
        const filledOrders: string[] = [];
        orders.forEach(order => {
          if ((order.side === 'buy' && newPrice <= order.price) || (order.side === 'sell' && newPrice >= order.price)) {
            const newFill: Fill = { timestamp: Date.now(), price: newPrice, size: 1, side: order.side };
            setFills(prev => [newFill, ...prev.slice(0, 49)]);
            setPosition({ entryPrice: newPrice, size: 1, pnl: 0, peakPrice: newPrice });
            setPnlHistory([{ time: Date.now(), pnl: 0 }]);
            toast.success(`Limit ${order.side} order filled at $${newPrice.toFixed(2)}`);
            filledOrders.push(order.id);
          }
        });
        setOrders(prev => prev.filter(o => !filledOrders.includes(o.id)));
        // Update position PnL and trailing stop
        if (position) {
          const newPnl = (newPrice - position.entryPrice) * position.size;
          const newPeakPrice = Math.max(position.peakPrice, newPrice);
          const stopPrice = newPeakPrice * (1 - trailingStopPercent / 100);
          if (newPrice < stopPrice) {
            toast.warning(`Trailing stop triggered at $${newPrice.toFixed(2)}`, { description: `Profit of $${newPnl.toFixed(2)} locked in.` });
            setPosition(null);
          } else {
            setPosition({ ...position, pnl: newPnl, peakPrice: newPeakPrice });
            setPnlHistory(prev => [...prev.slice(-99), { time: Date.now(), pnl: newPnl }]);
          }
        }
      }, 2000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, position, orders]);
  const placeOrder = (side: 'buy' | 'sell') => {
    const price = side === 'buy' ? lastPrice.current * 0.995 : lastPrice.current * 1.005;
    const newOrder: Order = { id: crypto.randomUUID(), price, side, type: 'limit' };
    setOrders(prev => [...prev, newOrder]);
    toast.info(`Limit ${side} order placed at $${price.toFixed(2)}`);
  };
  return (
    <div className="space-y-6">
      <Card className="shadow-soft rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Live Monitor</CardTitle>
          <div className="flex items-center gap-2">
            <Button onClick={() => setIsActive(!isActive)} size="sm">
              {isActive ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
              {isActive ? 'Pause' : 'Start'}
            </Button>
            <Button onClick={resetSimulation} size="sm" variant="outline"><RefreshCw className="w-4 h-4 mr-2" /> Reset</Button>
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
            <div className="h-48">
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
              <Button onClick={() => placeOrder('buy')} className="w-full bg-green-600 hover:bg-green-700">Place Buy Limit</Button>
              <Button onClick={() => placeOrder('sell')} className="w-full bg-red-600 hover:bg-red-700">Place Sell Limit</Button>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">Order Blotter</h3>
            <Card className="h-80 overflow-y-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Time</TableHead><TableHead>Side</TableHead><TableHead className="text-right">Price</TableHead></TableRow></TableHeader>
                <TableBody>
                  {fills.map((fill) => (
                    <motion.tr key={fill.timestamp} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
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