import React from 'react';
import { Play, Save } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Strategy } from '@/lib/trading';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Info } from 'lucide-react';
interface StrategyCardProps {
  strategy: Strategy;
  onStrategyChange: (strategy: Strategy) => void;
  onRunBacktest: (strategy: Strategy) => void;
  isLoading: boolean;
}
export function StrategyCard({ strategy, onStrategyChange, onRunBacktest, isLoading }: StrategyCardProps) {
  const handleParamChange = (param: string, value: number) => {
    onStrategyChange({ ...strategy, params: { ...strategy.params, [param]: value } });
  };
  const handleRiskChange = (param: string, value: number) => {
    onStrategyChange({ ...strategy, risk: { ...strategy.risk, [param]: value } });
  };
  const handleTypeChange = (type: 'sma-cross' | 'rsi-filter') => {
    let newParams = {};
    if (type === 'sma-cross') {
      newParams = { shortPeriod: 10, longPeriod: 20 };
    } else if (type === 'rsi-filter') {
      newParams = { rsiPeriod: 14, rsiUpper: 70, rsiLower: 30, smaPeriod: 50 };
    }
    onStrategyChange({ ...strategy, type, params: newParams });
  };
  return (
    <Card className="shadow-soft rounded-2xl">
      <CardHeader>
        <CardTitle>Strategy Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="strategy-type">Strategy Type</Label>
          <Select value={strategy.type} onValueChange={handleTypeChange}>
            <SelectTrigger id="strategy-type">
              <SelectValue placeholder="Select strategy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sma-cross">SMA Crossover</SelectItem>
              <SelectItem value="rsi-filter">RSI with SMA Filter</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {strategy.type === 'sma-cross' && (
          <div className="space-y-4">
            <div>
              <Label>Short Period: {strategy.params.shortPeriod}</Label>
              <Slider
                value={[strategy.params.shortPeriod || 10]}
                onValueChange={(v) => handleParamChange('shortPeriod', v[0])}
                min={5} max={50} step={1}
              />
            </div>
            <div>
              <Label>Long Period: {strategy.params.longPeriod}</Label>
              <Slider
                value={[strategy.params.longPeriod || 20]}
                onValueChange={(v) => handleParamChange('longPeriod', v[0])}
                min={10} max={100} step={1}
              />
            </div>
          </div>
        )}
        {strategy.type === 'rsi-filter' && (
          <div className="space-y-4">
             <div>
              <Label>RSI Period: {strategy.params.rsiPeriod}</Label>
              <Slider value={[strategy.params.rsiPeriod || 14]} onValueChange={(v) => handleParamChange('rsiPeriod', v[0])} min={5} max={30} step={1} />
            </div>
            <div>
              <Label>RSI Upper: {strategy.params.rsiUpper}</Label>
              <Slider value={[strategy.params.rsiUpper || 70]} onValueChange={(v) => handleParamChange('rsiUpper', v[0])} min={50} max={90} step={1} />
            </div>
            <div>
              <Label>RSI Lower: {strategy.params.rsiLower}</Label>
              <Slider value={[strategy.params.rsiLower || 30]} onValueChange={(v) => handleParamChange('rsiLower', v[0])} min={10} max={50} step={1} />
            </div>
            <div>
              <Label>SMA Filter Period: {strategy.params.smaPeriod}</Label>
              <Slider value={[strategy.params.smaPeriod || 50]} onValueChange={(v) => handleParamChange('smaPeriod', v[0])} min={20} max={200} step={1} />
            </div>
          </div>
        )}
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-lg font-semibold">Risk Management</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="slippage">Slippage (%)</Label>
              <Input id="slippage" type="number" value={strategy.risk.slippagePercent} onChange={(e) => handleRiskChange('slippagePercent', parseFloat(e.target.value))} step="0.01" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fees">Fees (%)</Label>
              <Input id="fees" type="number" value={strategy.risk.feePercent} onChange={(e) => handleRiskChange('feePercent', parseFloat(e.target.value))} step="0.01" />
            </div>
            <div className="space-y-2 col-span-2">
              <Label className="flex items-center gap-1">
                Stop Loss (%)
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3 h-3 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Percentage drop from entry price to trigger a stop loss.</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <Slider
                value={[strategy.risk.stopLossPercent || 2]}
                onValueChange={(v) => handleRiskChange('stopLossPercent', v[0])}
                min={0.5} max={10} step={0.5}
              />
              <div className="text-right text-sm text-muted-foreground">{strategy.risk.stopLossPercent}%</div>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" disabled={isLoading}>
          <Save className="w-4 h-4 mr-2" /> Save
        </Button>
        <Button onClick={() => onRunBacktest(strategy)} disabled={isLoading} className="bg-gradient-to-r from-[#F38020] to-[#d96f1c] hover:from-[#e0761b] hover:to-[#c46218] text-white shadow-md hover:shadow-lg transition-shadow">
          <Play className="w-4 h-4 mr-2" /> {isLoading ? 'Running...' : 'Run Backtest'}
        </Button>
      </CardFooter>
    </Card>
  );
}