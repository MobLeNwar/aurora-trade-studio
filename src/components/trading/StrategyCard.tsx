import React from 'react';
import { Play, Save, Info } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Strategy } from '@/lib/trading';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from 'sonner';
interface StrategyCardProps {
  strategy: Strategy;
  onStrategyChange: (strategy: Strategy) => void;
  onRunBacktest: (strategy: Strategy) => void;
  isLoading: boolean;
}
const riskPresets = {
  conservative: { stopLossPercent: 1, trailingStopPercent: 1, slippagePercent: 0.05, feePercent: 0.1 },
  balanced: { stopLossPercent: 2, trailingStopPercent: 2, slippagePercent: 0.05, feePercent: 0.1 },
  aggressive: { stopLossPercent: 5, trailingStopPercent: 3, slippagePercent: 0.1, feePercent: 0.1 },
};
export function StrategyCard({ strategy, onStrategyChange, onRunBacktest, isLoading }: StrategyCardProps) {
  const handleParamChange = (param: string, value: number) => onStrategyChange({ ...strategy, params: { ...strategy.params, [param]: value } });
  const handleRiskChange = (param: string, value: number) => onStrategyChange({ ...strategy, risk: { ...strategy.risk, [param]: value } });
  const handleTypeChange = (type: 'sma-cross' | 'rsi-filter') => {
    let newParams = type === 'sma-cross'
      ? { shortPeriod: 10, longPeriod: 20 }
      : { rsiPeriod: 14, rsiUpper: 70, rsiLower: 30, smaPeriod: 50 };
    onStrategyChange({ ...strategy, type, params: newParams });
  };
  const handlePresetChange = (preset: 'conservative' | 'balanced' | 'aggressive') => {
    onStrategyChange({ ...strategy, risk: { ...strategy.risk, ...riskPresets[preset] } });
    toast.success(`${preset.charAt(0).toUpperCase() + preset.slice(1)} risk preset applied.`);
  };
  const getRiskScore = () => {
    const score = (strategy.risk.stopLossPercent || 0) + (strategy.risk.trailingStopPercent || 0);
    if (score < 3) return { label: 'Low', color: 'bg-green-500' };
    if (score < 6) return { label: 'Medium', color: 'bg-yellow-500' };
    return { label: 'High', color: 'bg-red-500' };
  };
  const riskScore = getRiskScore();
  return (
    <Card className="shadow-soft rounded-2xl">
      <CardHeader><CardTitle>Strategy Configuration</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="strategy-type">Strategy Type</Label>
          <Select value={strategy.type} onValueChange={handleTypeChange}>
            <SelectTrigger id="strategy-type"><SelectValue placeholder="Select strategy" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sma-cross">SMA Crossover</SelectItem>
              <SelectItem value="rsi-filter">RSI with SMA Filter</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {strategy.type === 'sma-cross' && (
          <div className="space-y-4">
            <div><Label>Short Period: {strategy.params.shortPeriod}</Label><Slider value={[strategy.params.shortPeriod || 10]} onValueChange={(v) => handleParamChange('shortPeriod', v[0])} min={5} max={50} step={1} /></div>
            <div><Label>Long Period: {strategy.params.longPeriod}</Label><Slider value={[strategy.params.longPeriod || 20]} onValueChange={(v) => handleParamChange('longPeriod', v[0])} min={10} max={100} step={1} /></div>
          </div>
        )}
        <div className="space-y-4 pt-4 border-t">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Risk Management</h3>
            <Badge className={riskScore.color}>{riskScore.label} Risk</Badge>
          </div>
          <Select onValueChange={(v) => handlePresetChange(v as any)}><SelectTrigger><SelectValue placeholder="Apply Risk Preset" /></SelectTrigger><SelectContent><SelectItem value="conservative">Conservative</SelectItem><SelectItem value="balanced">Balanced</SelectItem><SelectItem value="aggressive">Aggressive</SelectItem></SelectContent></Select>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2"><Label className="flex items-center gap-1">Stop Loss (%)<TooltipProvider><Tooltip><TooltipTrigger asChild><Info className="w-3 h-3 text-muted-foreground" /></TooltipTrigger><TooltipContent><p>Percentage drop from entry to trigger a stop loss.</p></TooltipContent></Tooltip></TooltipProvider></Label><Slider value={[strategy.risk.stopLossPercent || 2]} onValueChange={(v) => handleRiskChange('stopLossPercent', v[0])} min={0.5} max={10} step={0.5} /><div className="text-right text-sm text-muted-foreground">{strategy.risk.stopLossPercent}%</div></div>
            <div className="space-y-2 col-span-2"><Label className="flex items-center gap-1">Trailing Stop (%)<TooltipProvider><Tooltip><TooltipTrigger asChild><Info className="w-3 h-3 text-muted-foreground" /></TooltipTrigger><TooltipContent><p>Stop loss that follows the price as it moves in your favor.</p></TooltipContent></Tooltip></TooltipProvider></Label><Slider value={[strategy.risk.trailingStopPercent || 0]} onValueChange={(v) => handleRiskChange('trailingStopPercent', v[0])} min={0} max={5} step={0.5} /><div className="text-right text-sm text-muted-foreground">{strategy.risk.trailingStopPercent}%</div></div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" disabled={isLoading}><Save className="w-4 h-4 mr-2" /> Save</Button>
        <Button onClick={() => onRunBacktest(strategy)} disabled={isLoading} className="bg-gradient-to-r from-[#F38020] to-[#d96f1c] hover:from-[#e0761b] hover:to-[#c46218] text-white shadow-md hover:shadow-lg transition-shadow"><Play className="w-4 h-4 mr-2" /> {isLoading ? 'Running...' : 'Run Backtest'}</Button>
      </CardFooter>
    </Card>
  );
}