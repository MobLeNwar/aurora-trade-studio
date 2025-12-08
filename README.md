# Aurora Trade Studio

[![[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/MobLeNwar/aurora-trade-studio)]](https://workers.cloudflare.com)

Aurora Trade Studio is a visually exceptional, Cloudflare edge-powered frontend for exploring, backtesting, and interactively prototyping AI-assisted trading strategies. It pairs a stunning, mobile-first UI built with shadcn/ui + Tailwind with Cloudflare Agents (Durable Objects) AI backend to explain trade signals, generate strategy variants, run client-side backtests and simulations (mock data initially), and present a polished paper-trading monitor. The app emphasizes transparent metrics like win-rate, expectancy, and drawdown, with rigorous backtesting and intuitive UX for responsible strategy iteration.

**Important Disclaimer**: This tool is for educational and simulation purposes only. We do not guarantee any win-rate (including 80%) and provide no investment advice. Backtesting and simulated results are indicative and not indicative of future performance. Always consult financial professionals and trade responsibly.

## Key Features

- **Strategy Builder**: Create or edit rule-based strategies using presets like SMA/EMA crossovers and RSI filters, with parameter sliders and live preview.
- **Backtester & Simulator**: Run deterministic backtests and Monte Carlo stress tests on historical data ranges (mock in Phase 1), displaying PnL charts, equity curves, drawdowns, win-rate, and trade lists.
- **Signal Explorer (AI Assistant)**: Contextual chat interface powered by Cloudflare Agents API to explain trade signals, suggest parameter variants, and provide plain-English indicator explanations.
- **Live Monitor (Paper Trading)**: Real-time simulated feed of fills, positions, order blotter, PnL tracking, and pause/resume controls (mocked in Phase 1).
- **Settings & Sessions**: Manage saved strategies, persistent sessions via Durable Objects, risk presets, and account preferences.
- **Visual Excellence**: Modern, responsive UI with gradients, smooth animations, and micro-interactions using Tailwind and framer-motion.
- **Edge-Powered AI**: Leverages Cloudflare Workers for secure, serverless AI interactions without client-side API keys.
- **Legal & Safety Focus**: Prominent disclaimers on risks, overfitting, and simulation limitations.

## Technology Stack

- **Frontend**: React 18, Vite, Tailwind CSS, shadcn/ui (Radix UI primitives), framer-motion (animations), Recharts (charts and indicators), Lucide React (icons).
- **State Management**: Zustand (lightweight), @tanstack/react-query (data fetching/caching).
- **Backend/AI**: Cloudflare Workers, Agents SDK (Durable Objects), Hono (routing), OpenAI SDK (via Cloudflare AI Gateway), Model Context Protocol (MCP) for tools.
- **Utilities**: date-fns (dates), technicalindicators (TA computations), Sonner (notifications), Zod (validation), Immer (immutability).
- **Development**: TypeScript, ESLint, Bun (package manager).

## Quick Start

To get started quickly, fork this repository and deploy to Cloudflare Workers:

[[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/MobLeNwar/aurora-trade-studio)]

## Installation

1. **Clone the Repository**:
   ```bash
   git clone <your-repo-url>
   cd aurora-trade-studio
   ```

2. **Install Dependencies** (using Bun):
   ```bash
   bun install
   ```

3. **Environment Setup**:
   - Create a `.dev.vars` file in the root (for local development):
     ```
     CF_AI_BASE_URL=https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_id}/openai
     CF_AI_API_KEY={your_ai_gateway_key}
     ```
   - For production, configure these in your Cloudflare Worker dashboard under Settings > Variables.
   - Note: AI features require a Cloudflare AI Gateway setup. Free tier limits apply (global request quotas across users).

4. **Generate TypeScript Types** (Cloudflare-specific):
   ```bash
   bun run cf-typegen
   ```

## Development

1. **Run Locally**:
   ```bash
   bun run dev
   ```
   - Access at `http://localhost:3000` (or your configured port).
   - The Worker backend runs via Wrangler integration.

2. **Build for Production**:
   ```bash
   bun run build
   ```

3. **Preview Build**:
   ```bash
   bun run preview
   ```

4. **Linting**:
   ```bash
   bun run lint
   ```

### Usage Examples

- **Landing/Dashboard**: Navigate to `/` for hero overview, quick actions (New Strategy), global stats, and session switcher. AI notes on limits/risks are displayed.
- **Strategy Builder**: Select presets (e.g., SMA Crossover), adjust sliders for periods (e.g., fast=10, slow=20), preview signals on mock candlestick data.
- **Backtesting**: Choose date range, run simulation → View Recharts equity curve, trade table with metrics (win-rate, Sharpe ratio).
- **AI Signal Explorer**: In chat panel, query "Why short at 2023-05-12?" → Calls `/api/chat/:sessionId/chat` for explanations.
- **Paper Trading**: Enable monitor for streamed mock fills; track positions in real-time.
- **Sessions**: Save/load via `/api/sessions`; persists strategy configs in Durable Objects.

All views use the root wrapper for responsive gutters (`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`). Mobile-first design ensures touch-friendly interactions.

**AI Request Limits**: The Cloudflare AI Gateway has global quotas. Monitor usage in the UI and avoid excessive calls. For development, use mock responses if needed.

## Deployment

Deploy to Cloudflare Workers for edge-first performance:

1. **Install Wrangler CLI** (if not already):
   ```bash
   bun add -g wrangler
   wrangler auth login
   ```

2. **Configure Secrets**:
   ```bash
   wrangler secret put CF_AI_API_KEY
   wrangler secret put SERPAPI_KEY  # Optional for web search tools
   ```

3. **Deploy**:
   ```bash
   bun run deploy
   ```
   - Or use the dashboard: Workers & Pages > Create Application > Import from Git.
   - Assets (frontend) auto-bundle via Vite; API routes handle via Hono in Worker.

For one-click deployment:

[[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/MobLeNwar/aurora-trade-studio)]

**Post-Deployment Notes**:
- Custom domain: Configure in Worker Settings.
- Observability: Enabled via Wrangler (logs/metrics).
- Scaling: Automatic; Durable Objects handle persistent sessions.
- Phase 1 Demo: Uses mock data; no external APIs needed beyond AI Gateway.

## Contributing

1. Fork the repository.
2. Create a feature branch (`git checkout -b feature/amazing-feature`).
3. Commit changes (`git commit -m 'Add amazing feature'`).
4. Push to branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.

Follow existing code style (TypeScript, Tailwind utilities). Focus on visual polish, error handling, and avoiding lookahead bias in backtests.

## License

This project is MIT licensed. See [LICENSE](LICENSE) for details.

## Support

- **Issues**: Report bugs/feature requests on GitHub.
- **Docs**: Refer to Cloudflare Workers docs for Agents/Durable Objects.
- **Community**: Join Cloudflare Discord for deployment help.

Built with ❤️ by Cloudflare's edge-first development team. Trade smart!