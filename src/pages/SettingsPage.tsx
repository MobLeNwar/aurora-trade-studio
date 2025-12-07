import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Settings, Save, Trash2, Share2, Bell, Palette, KeyRound, BarChart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Toaster, toast } from 'sonner';
import { chatService } from '@/lib/chat';
import type { SessionInfo } from '../../worker/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
export default function SettingsPage() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [notifications, setNotifications] = useState(true);
  const [symbol, setSymbol] = useState(() => localStorage.getItem('trading-config-symbol') || 'BTC/USDT');
  const [exchange, setExchange] = useState(() => localStorage.getItem('trading-config-exchange') || 'binance');
  const loadSessions = async () => {
    const response = await chatService.listSessions();
    if (response.success && response.data) {
      setSessions(response.data);
    } else {
      toast.error("Failed to load strategies.");
    }
  };
  useEffect(() => {
    loadSessions();
    const savedPrefs = localStorage.getItem('aurora-prefs');
    if (savedPrefs) {
      setNotifications(JSON.parse(savedPrefs).notifications);
    }
  }, []);
  const handleNotificationToggle = (checked: boolean) => {
    setNotifications(checked);
    localStorage.setItem('aurora-prefs', JSON.stringify({ notifications: checked }));
    toast.success(`Notifications ${checked ? 'enabled' : 'disabled'}.`);
  };
  const handleSaveTradingConfig = () => {
    localStorage.setItem('trading-config-symbol', symbol);
    localStorage.setItem('trading-config-exchange', exchange);
    toast.success('Trading configuration saved.');
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
  const handleShare = (sessionId: string) => {
    const url = `${window.location.origin}/trade?session=${sessionId}`;
    navigator.clipboard.writeText(url);
    toast.success('Share link copied to clipboard!');
  };
  return (
    <div className="min-h-screen bg-muted/30 dark:bg-background/50">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/80 backdrop-blur-lg px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#F38020] to-[#4F46E5] flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-lg font-bold font-display hidden sm:block">Aurora</h1>
        </Link>
        <div className="flex-1" />
        <Button variant="ghost" asChild><Link to="/trade">Dashboard</Link></Button>
        <ThemeToggle className="relative top-0 right-0" />
      </header>
      <main>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-8 md:py-10 lg:py-12">
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-4xl font-bold font-display mb-2">Settings & Sessions</h1>
              <p className="text-muted-foreground">Manage your strategies, risk profiles, and application preferences.</p>
            </motion.div>
            <Tabs defaultValue="sessions" className="mt-8">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="sessions">Sessions</TabsTrigger>
                <TabsTrigger value="api">API & Data</TabsTrigger>
                <TabsTrigger value="prefs">Preferences</TabsTrigger>
              </TabsList>
              <TabsContent value="sessions" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Saved Strategies</CardTitle>
                    <CardDescription>Load, share, or delete your saved trading strategies.</CardDescription>
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
                        {sessions.length > 0 ? sessions.map(session => (
                          <TableRow key={session.id}>
                            <TableCell className="font-medium">{session.title}</TableCell>
                            <TableCell>{new Date(session.lastActive).toLocaleString()}</TableCell>
                            <TableCell className="text-right space-x-1">
                              <Button variant="ghost" size="icon" onClick={() => handleShare(session.id)}><Share2 className="w-4 h-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(session.id, session.title)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                            </TableCell>
                          </TableRow>
                        )) : (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center h-24">No strategies saved yet.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="api" className="mt-6 space-y-6">
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><BarChart className="w-5 h-5" /> Market Data</CardTitle><CardDescription>Configure the default market for backtesting and paper trading.</CardDescription></CardHeader>
                  <CardContent className="space-y-4">
                    <div><Label htmlFor="exchange">Exchange</Label><Select value={exchange} onValueChange={setExchange}><SelectTrigger id="exchange"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="binance">Binance</SelectItem><SelectItem value="coinbasepro">Coinbase Pro</SelectItem><SelectItem value="kraken">Kraken</SelectItem></SelectContent></Select></div>
                    <div><Label htmlFor="symbol">Symbol</Label><Input id="symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="e.g., BTC/USDT" /></div>
                    <Button onClick={handleSaveTradingConfig}><Save className="w-4 h-4 mr-2" /> Save Data Config</Button>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="w-5 h-5" /> Paper Trading (Alpaca)</CardTitle><CardDescription>To enable real paper trading, set your API keys as secrets in your Cloudflare Worker.</CardDescription></CardHeader>
                  <CardContent className="text-sm text-muted-foreground space-y-2">
                    <p>1. Go to your Cloudflare Dashboard &gt; Workers & Pages &gt; Select this application.</p>
                    <p>2. Navigate to Settings &gt; Variables.</p>
                    <p>3. Add the following secrets:</p>
                    <ul className="list-disc pl-6 font-mono text-xs">
                      <li><span className="font-semibold">ALPACA_API_KEY</span>: Your paper trading API Key ID.</li>
                      <li><span className="font-semibold">ALPACA_SECRET_KEY</span>: Your paper trading Secret Key.</li>
                    </ul>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="prefs" className="mt-6">
                <Card>
                  <CardHeader><CardTitle>Application Preferences</CardTitle></CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <Label htmlFor="notifications" className="flex items-center gap-2"><Bell className="w-4 h-4" /> Notifications</Label>
                        <p className="text-sm text-muted-foreground">Enable or disable toast notifications for fills and alerts.</p>
                      </div>
                      <Switch id="notifications" checked={notifications} onCheckedChange={handleNotificationToggle} />
                    </div>
                     <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1">
                        <Label className="flex items-center gap-2"><Palette className="w-4 h-4" /> Theme</Label>
                        <p className="text-sm text-muted-foreground">Toggle between light and dark mode.</p>
                      </div>
                      <ThemeToggle className="relative" />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>
      <Toaster richColors />
    </div>
  );
}