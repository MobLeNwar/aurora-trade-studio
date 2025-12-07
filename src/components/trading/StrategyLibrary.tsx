import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { PlusCircle, Trash2, Upload, Download } from 'lucide-react';
import { chatService } from '@/lib/chat';
import { Strategy } from '@/lib/trading';
import { toast } from 'sonner';
import type { SessionInfo } from '../../../worker/types';
interface StrategyLibraryProps {
  currentStrategy: Strategy;
  onLoadStrategy: (strategy: Strategy) => void;
}
export function StrategyLibrary({ currentStrategy, onLoadStrategy }: StrategyLibraryProps) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [newStrategyName, setNewStrategyName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadSessions = async () => {
    const response = await chatService.listSessions();
    if (response.success && response.data) {
      setSessions(response.data);
    }
  };
  useEffect(() => {
    loadSessions();
  }, []);
  const handleSave = async () => {
    if (!newStrategyName.trim()) {
      toast.error('Strategy name cannot be empty.');
      return;
    }
    const symbol = localStorage.getItem('trading-config-symbol') || 'BTC/USDT';
    const exchange = localStorage.getItem('trading-config-exchange') || 'binance';
    const config = { symbol, exchange };
    const strategyJson = JSON.stringify(currentStrategy);
    const response = await chatService.createSession(newStrategyName, undefined, strategyJson, config);
    if (response.success) {
      toast.success(`Strategy "${newStrategyName}" saved.`);
      setNewStrategyName('');
      loadSessions();
    } else {
      toast.error('Failed to save strategy.');
    }
  };
  const handleDelete = async (sessionId: string, title: string) => {
    const response = await chatService.deleteSession(sessionId);
    if (response.success) {
      toast.success(`Strategy "${title}" deleted.`);
      loadSessions();
    } else {
      toast.error('Failed to delete strategy.');
    }
  };
  const handleLoad = async (sessionId: string) => {
    const response = await chatService.getSession(sessionId);
    if (response.success && response.data?.strategy) {
      try {
        const loadedStrategy = JSON.parse(response.data.strategy);
        onLoadStrategy(loadedStrategy);
        if (response.data.config) {
          localStorage.setItem('trading-config-symbol', response.data.config.symbol);
          localStorage.setItem('trading-config-exchange', response.data.config.exchange);
          toast.success(`Strategy and config for ${response.data.config.symbol} loaded. Please refresh the page to see data changes.`);
        } else {
          toast.success('Strategy loaded.');
        }
      } catch {
        toast.error('Could not parse strategy from session.');
      }
    } else {
      toast.error('Failed to load strategy data.');
    }
  };
  const handleExport = () => {
    const dataStr = JSON.stringify(sessions, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'aurora-strategies.json';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('All strategies exported.');
  };
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedSessions = JSON.parse(e.target?.result as string) as SessionInfo[];
        // This is a simplified import; a real app would merge or replace.
        for (const session of importedSessions) {
          await chatService.createSession(session.title, session.id, session.strategy, session.config);
        }
        toast.success(`${importedSessions.length} strategies imported.`);
        loadSessions();
      } catch {
        toast.error('Failed to parse import file.');
      }
    };
    reader.readAsText(file);
  };
  return (
    <Card className="shadow-soft rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Strategy Library</CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleExport}><Download className="w-4 h-4 mr-2" /> Export</Button>
          <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="w-4 h-4 mr-2" /> Import</Button>
          <Input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImport} />
          <Dialog>
            <DialogTrigger asChild><Button size="sm"><PlusCircle className="w-4 h-4 mr-2" /> New</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Save Current Strategy</DialogTitle></DialogHeader>
              <Input placeholder="Enter strategy name..." value={newStrategyName} onChange={(e) => setNewStrategyName(e.target.value)} />
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="secondary">Cancel</Button></DialogClose>
                <DialogClose asChild><Button onClick={handleSave}>Save</Button></DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Last Active</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {sessions.map(session => (
              <TableRow key={session.id}>
                <TableCell>{session.title}</TableCell>
                <TableCell>{new Date(session.lastActive).toLocaleDateString()}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button variant="ghost" size="icon" onClick={() => handleLoad(session.id)}><Upload className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(session.id, session.title)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}