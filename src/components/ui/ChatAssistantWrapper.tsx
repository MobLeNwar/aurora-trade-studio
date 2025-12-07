import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Send, Bot, User, Wrench, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { chatService, renderToolCall } from '@/lib/chat';
import type { ChatState, Message } from '../../../worker/types';
import type { Strategy, BacktestResult } from '@/lib/trading';
interface ChatAssistantWrapperProps {
  strategy: Strategy;
  backtestResult: BacktestResult | null;
}
export function ChatAssistantWrapper({ strategy, backtestResult }: ChatAssistantWrapperProps) {
  const [chatState, setChatState] = useState<ChatState>({
    messages: [],
    sessionId: chatService.getSessionId(),
    isProcessing: false,
    model: 'google-ai-studio/gemini-2.5-flash',
    streamingMessage: ''
  });
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatState.messages, chatState.streamingMessage]);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatState.isProcessing) return;
    const message = input.trim();
    setInput('');
    console.log(`AI Query: ${message}`);
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      timestamp: Date.now()
    };
    setChatState(prev => ({ ...prev, messages: [...prev.messages, userMessage], isProcessing: true, streamingMessage: '' }));
    await chatService.sendWithContext(message, strategy, backtestResult, null, chatState.model, (chunk) => {
      setChatState(prev => ({ ...prev, streamingMessage: (prev.streamingMessage || '') + chunk }));
    });
    const response = await chatService.getMessages();
    if (response.success && response.data) {
      setChatState(prev => ({ ...prev, ...response.data, isProcessing: false, streamingMessage: '' }));
    } else {
      setChatState(prev => ({ ...prev, isProcessing: false }));
    }
  };
  return (
    <Card className="shadow-soft rounded-2xl h-[calc(100vh-200px)] flex flex-col">
      <CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" /> AI Signal Explorer</CardTitle></CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full p-4">
          {chatState.messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <Bot className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Ask about your strategy or backtest results.</p>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                <Badge variant="secondary">Explain the last trade</Badge>
                <Badge variant="secondary">Suggest improvements</Badge>
              </div>
            </div>
          )}
          <div className="space-y-4">
            {chatState.messages.map((msg) => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && <Bot className="w-6 h-6 flex-shrink-0" />}
                <div className={`max-w-[85%] p-3 rounded-2xl ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                  <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                  {msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-current/20"><div className="flex items-center gap-1 mb-2 text-xs opacity-70"><Wrench className="w-3 h-3" /> Tools used:</div>{msg.toolCalls.map((tool, idx) => (<Badge key={idx} variant="outline" className="mr-1 mb-1 text-xs">{renderToolCall(tool)}</Badge>))}</div>
                  )}
                </div>
                {msg.role === 'user' && <User className="w-6 h-6 flex-shrink-0" />}
              </motion.div>
            ))}
            {chatState.streamingMessage && (
              <div className="flex gap-3 justify-start"><Bot className="w-6 h-6 flex-shrink-0" /><div className="bg-muted p-3 rounded-2xl max-w-[85%]"><p className="whitespace-pre-wrap text-sm">{chatState.streamingMessage}<span className="animate-pulse">|</span></p></div></div>
            )}
            {chatState.isProcessing && !chatState.streamingMessage && (
              <div className="flex justify-start"><div className="bg-muted p-3 rounded-2xl"><div className="flex space-x-1">{[0, 1, 2].map(i => (<div key={i} className="w-2 h-2 bg-current rounded-full animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />))}</div></div></div>
            )}
          </div>
          <div ref={messagesEndRef} />
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-4 border-t">
        <form onSubmit={handleSubmit} className="w-full flex gap-2 items-center">
          <Textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleSubmit(e); }} placeholder="Ask AI to explain a signal..." className="flex-1 min-h-[42px] max-h-24 resize-none" rows={1} disabled={chatState.isProcessing} />
          <Button type="submit" disabled={!input.trim() || chatState.isProcessing}><Send className="w-4 h-4" /></Button>
        </form>
      </CardFooter>
    </Card>
  );
}