import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, DollarSign, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
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
}
export function PaperTradingMonitor() {
  const [isActive, setIsActive] = useState(false);
  const [fills, setFills] = useState<Fill[]>([]);
  const [position, setPosition] = useState<Position | null>(null);
  const [pnlHistory, setPnlHistory] = useState<{ time: number; pnl: number }[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPrice = useRef(112.0);
  useEffect(() => {
    if (isActive) {
      intervalRef.current = setInterval(() => {
        const priceChange = (Math.random() - 0.5) * 0.5;
        const newPrice = Math.max(100, lastPrice.current + priceChange);
        lastPrice.current = newPrice;
        if (position) {
          const newPnl = (newPrice - position.entryPrice) * position.size;
          setPosition({ ...position, pnl: newPnl });
          setPnlHistory(prev => [...prev.slice(-99), { time: Date.now(), pnl: newPnl }]);
        }
        // Simulate random fills
        if (Math.random() < 0.1) {
          const side = Math.random() > 0.5 ? 'buy' : 'sell';
          const newFill: Fill = {
            timestamp: Date.now(),
            price: newPrice,
            size: 1,
            side,
          };
          setFills(prev => [newFill, ...prev.slice(0, 49)]);
          if (!position) {
            setPosition({ entryPrice: newPrice, size: 1, pnl: 0 });
            setPnlHistory([{ time: Date.now(), pnl: 0 }]);
          } else {
            // Simple logic: close and reopen
            toast.info(`Position closed at ${position.entryPrice.toFixed(2)} and reopened at ${newPrice.toFixed(2)}`);
            setPosition({ entryPrice: newPrice, size: 1, pnl: 0 });
            setPnlHistory([{ time: Date.now(), pnl: 0 }]);
          }
        }
      }, 2000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, position]);
  return (
    <div className="space-y-6">
      <Card className="shadow-soft rounded-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Live Monitor</CardTitle>
          <Button onClick={() => setIsActive(!isActive)} size="sm">
            {isActive ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            {isActive ? 'Pause' : 'Start'} Simulation
          </Button>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium flex items-center gap-2 text-muted-foreground">
                  <TrendingUp className="w-5 h-5" /> Current Position
                </CardTitle>
              </CardHeader>
              <CardContent>
                {position ? (
                  <>
                    <div className={`text-3xl font-bold ${position.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      ${position.pnl.toFixed(2)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Entry: ${position.entryPrice.toFixed(2)} | Size: {position.size}
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground">No active position.</p>
                )}
              </CardContent>
            </Card>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pnlHistory}>
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }} />
                  <YAxis domain={['auto', 'auto']} hide />
                  <XAxis dataKey="time" type="number" domain={['dataMin', 'dataMax']} hide />
                  <Line type="monotone" dataKey="pnl" stroke={position && position.pnl >= 0 ? '#22c55e' : '#ef4444'} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-2">Order Blotter</h3>
            <Card className="h-80">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Side</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fills.map((fill) => (
                    <TableRow key={fill.timestamp}>
                      <TableCell>{new Date(fill.timestamp).toLocaleTimeString()}</TableCell>
                      <TableCell>
                        <Badge variant={fill.side === 'buy' ? 'default' : 'destructive'} className={fill.side === 'buy' ? 'bg-green-500/20 text-green-700' : 'bg-red-500/20 text-red-700'}>
                          {fill.side}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">${fill.price.toFixed(2)}</TableCell>
                    </TableRow>
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