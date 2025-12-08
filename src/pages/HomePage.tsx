import { useNavigate } from 'react-router-dom';
import { ArrowRight, Bot, BrainCircuit, CandlestickChart, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Toaster } from '@/components/ui/sonner';
const stats = [
  {
    icon: <BrainCircuit className="w-8 h-8 text-primary" />,
    value: '1,200+',
    label: 'Strategies Backtested',
  },
  {
    icon: <CandlestickChart className="w-8 h-8 text-primary" />,
    value: '15.7M+',
    label: 'Simulated Trades',
  },
  {
    icon: <Bot className="w-8 h-8 text-primary" />,
    value: '99.8%',
    label: 'AI Explanation Uptime',
  },
  {
    icon: <Zap className="w-8 h-8 text-primary" />,
    value: '85ms',
    label: 'Avg. Backtest Speed',
  },
];
export function HomePage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <ThemeToggle className="fixed top-4 right-4" />
      <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#F38020] to-[#4F46E5] flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold font-display">Aurora Trade Studio</h1>
        </div>
        <Button variant="ghost" onClick={() => navigate('/trade')}>
          Launch App
        </Button>
      </header>
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-24 md:py-32 lg:py-40 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            >
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold font-display tracking-tighter text-balance">
                Design, Test, and Refine
                <br />
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#F38020] to-[#4F46E5]">
                  AI-Powered Trading Strategies
                </span>
              </h1>
              <p className="mt-6 max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground text-balance">
                Aurora is a visually exceptional studio for backtesting and prototyping trading strategies with transparent metrics and AI-driven signal explanations.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" className="w-full sm:w-auto text-lg font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-shadow duration-300 bg-gradient-to-r from-[#F38020] to-[#d96f1c] hover:from-[#e0761b] hover:to-[#c46218] text-white" onClick={() => navigate('/trade')}>
                  Start Building <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
                <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg">
                  Learn More
                </Button>
              </div>
            </motion.div>
          </div>
          <div className="pb-24 md:pb-32 lg:pb-40">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
                >
                  <Card className="shadow-soft hover:shadow-md transition-shadow duration-300 border-border/80 rounded-2xl">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
                      {stat.icon}
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{stat.value}</div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <footer className="bg-muted/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-center text-muted-foreground text-sm">
          <p className="font-semibold">Important Disclaimer</p>
          <p className="max-w-3xl mx-auto mt-2">
            AI usage is rate-limited — some requests may be delayed. All backtesting and simulated results are indicative only and do not constitute financial advice. Past performance is not indicative of future results. Trade responsibly.
          </p>
          <p className="mt-4">Built with ❤️ at Cloudflare</p>
        </div>
      </footer>
      <Toaster />
    </div>
  );
}

export default HomePage;