import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trade } from '@/lib/trading';
import { format } from 'date-fns';
interface TradeTableProps {
  trades: Trade[];
}
export function TradeTable({ trades }: TradeTableProps) {
  return (
    <Card className="shadow-soft rounded-2xl">
      <CardHeader>
        <CardTitle>Trade History</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entry Time</TableHead>
                <TableHead>Exit Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Entry Price</TableHead>
                <TableHead className="text-right">Exit Price</TableHead>
                <TableHead className="text-right">PnL (%)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trades.length > 0 ? (
                trades.map((trade, index) => (
                  <TableRow key={index}>
                    <TableCell>{format(new Date(trade.entryTime), 'yyyy-MM-dd HH:mm')}</TableCell>
                    <TableCell>{format(new Date(trade.exitTime), 'yyyy-MM-dd HH:mm')}</TableCell>
                    <TableCell>
                      <Badge variant={trade.type === 'long' ? 'default' : 'destructive'} className={trade.type === 'long' ? 'bg-green-500/20 text-green-700 dark:bg-green-500/10 dark:text-green-400' : 'bg-red-500/20 text-red-700 dark:bg-red-500/10 dark:text-red-400'}>
                        {trade.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">${trade.entryPrice.toFixed(2)}</TableCell>
                    <TableCell className="text-right">${trade.exitPrice.toFixed(2)}</TableCell>
                    <TableCell className={`text-right font-medium ${trade.pnl > 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {trade.pnl.toFixed(2)} ({(trade.pnlPercent * 100).toFixed(2)}%)
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    No trades to display. Run a backtest to see results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}