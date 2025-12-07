import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Zap, Settings, Save, Trash2, Upload, Download, Share2, Bell, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Toaster, toast } from 'sonner';
import { chatService } from '@/lib/chat';
import type { SessionInfo } from '../../../worker/types';
import type { Strategy } from '@/lib/trading';
const RiskPresetCard = ({ title, description, onSelect }: { title: string, description: string, onSelect: () => void }) => (
  <Card className="hover:shadow-md transition-shadow">
    <CardHeader>
      <CardTitle>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent>
      <Button onClick={onSelect} className="w-full">Apply Preset</Button>
    </CardContent>
  </Card>
);
export default function SettingsPage() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [notifications, setNotifications] = useState(true);
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
                <TabsTrigger value="risk">Risk Presets</TabsTrigger>
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
              <TabsContent value="risk" className="mt-6">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <RiskPresetCard title="Conservative" description="Low risk, small position sizes, tight stops." onSelect={() => toast.info("Conservative preset applied (mock).")} />
                  <RiskPresetCard title="Balanced" description="Moderate risk, standard position sizes." onSelect={() => toast.info("Balanced preset applied (mock).")} />
                  <RiskPresetCard title="Aggressive" description="High risk, larger positions, wider stops." onSelect={() => toast.info("Aggressive preset applied (mock).")} />
                </div>
              </TabsContent>
              <TabsContent value="prefs" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Application Preferences</CardTitle>
                  </CardHeader>
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