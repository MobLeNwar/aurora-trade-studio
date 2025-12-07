import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { PlusCircle, Trash2, Download, Upload } from 'lucide-react';
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
    const response = await chatService.createSession(newStrategyName, undefined, JSON.stringify(currentStrategy));
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
    const response = await chatService.getMessages(); // This is a workaround, we need a way to get session data
    // In a real app, you'd fetch the strategy JSON from the session.
    // Here we assume the last message content is the strategy.
    const lastMessage = response.data?.messages.find(m => m.role === 'user');
    if (lastMessage) {
      try {
        const loadedStrategy = JSON.parse(lastMessage.content);
        onLoadStrategy(loadedStrategy);
        toast.success('Strategy loaded.');
      } catch {
        toast.error('Could not parse strategy from session.');
      }
    }
  };
  return (
    <Card className="shadow-soft rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Strategy Library</CardTitle>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm"><PlusCircle className="w-4 h-4 mr-2" /> New</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save Current Strategy</DialogTitle>
            </DialogHeader>
            <Input
              placeholder="Enter strategy name..."
              value={newStrategyName}
              onChange={(e) => setNewStrategyName(e.target.value)}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">Cancel</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button onClick={handleSave}>Save</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Last Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
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