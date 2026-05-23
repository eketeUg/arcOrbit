# 🪐 arcOrbit - Programmable Treasury & Cross-Chain Ingress Agent

This is the codebase for **arcOrbit Agent**, a NestJS-based agent backend implementing the **ARC Treasury Vault** and the **Cross-Chain USDC Ingress Engine** integrated with a Telegram Bot UI.

---

## 🛠️ Codebase Architecture

```
src/
├── agent/       # AgentService - Cross-chain USDC rebalancer & CCTP scheduler
├── bot/         # BotService & Markups - Telegram user interface & navigation flows
├── database/    # User, Session, Snapshot, Transaction, and Job Mongoose Schemas
├── price/       # PriceService - Real-time ARC Testnet swap estimation prices
├── relay/       # RelayService - Circle AppKit bridge and swap wrappers
├── swap/        # SwapService - slippage checking, 3x retry backoff loops, swap execution
├── user/        # UserService - Telegram user registration and wallet sets setup
└── vault/       # VaultService - Balance sync, USD valuation, portfolio snapshots
```

---

## 🚀 Getting Started

### 📋 Environment Variables
Create a `.env` file in the root of this folder containing:
```env
TELEGRAM_TOKEN=your_telegram_bot_token
MONGO_URI=your_mongodb_connection_string
CIRCLE_API_KEY=your_circle_api_key
CIRCLE_ENTITY_SECRET=your_circle_entity_secret
KIT_KEY=your_app_kit_key
```

### 🔧 Installation
```bash
pnpm install
```

### 🏃 Compilation & Execution
```bash
# Start NestJS in watch mode (development)
pnpm run start:dev

# Build for production
pnpm run build

# Run in production mode
pnpm run start:prod
```

### 🧪 Tests
```bash
# Run unit tests
pnpm run test

# Run end-to-end tests
pnpm run test:e2e
```
