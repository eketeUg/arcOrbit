# 🪐 arcOrbit

**arcOrbit** is a next-generation **Cross-Chain USDC Ingress & Programmable Treasury Hub** built on the **ARC Testnet**. It enables automated rebalancing of multi-asset treasuries (USDC, EURC, cirBTC) on ARC, combined with intelligent cross-chain USDC routing (ingress/egress) across Base Sepolia, Solana Devnet, and ARC Testnet via Circle's CCTP.

---

## 🌟 Key Features

### 1. Programmable Treasury Hub (ARC Testnet)

- **Multi-Asset Vault**: Manages a central treasury of `USDC`, `EURC`, and `cirBTC` on the ARC Testnet.
- **On-Chain Swap Layer**: Executes high-performance token swaps using Circle's AppKit, featuring built-in slippage protection, quote estimation, and transaction logging.
- **Vault Rebalancing Engine**: Compares target allocations (e.g. 50% USDC / 30% EURC / 20% cirBTC) against actual token valuations, automatically executing swaps on ARC to correct portfolio drift.
- **On-Chain Price Engine**: Uses swap simulation estimates (`estimateSwap`) on ARC Testnet to get real-time price feeds of EURC and cirBTC in USD/USDC, with a resilient fallback mechanism.

### 2. Cross-Chain Ingress & Egress Engine (CCTP)

- **Unified Balance Queries**: Seamlessly aggregates USDC balances from Base Sepolia (EVM address) and Solana Devnet (SVM address) using Circle's Developer Controlled Wallets.
- **Ingress Routing**: Automatically detects excess USDC on external source chains (Base, Solana) and bridges it to the central ARC Treasury Hub.
- **Egress Routing**: Automatically routes capital back out from ARC Testnet to Base/Solana via Circle's Cross-Chain Transfer Protocol (CCTP) if their allocations drop below user targets.
- **Asynchronous Locks**: Employs an in-memory lock manager per user to prevent concurrent bridging attempts while CCTP bridges settle.

### 3. Telegram Agent User Interface

- **Feature Hub**: Main menu (`/menu`) displaying EVM/SVM addresses, target allocations, and total USD valuation of the ARC vault.
- **Allocation Splits Config**: Setting target vault allocations and cross-chain splits (e.g., `40 40 20` for Base/Solana/ARC) directly via space-separated conversational bot prompts.
- **Simulation & Dry Runs**: Dry-run buttons for both ARC swaps and cross-chain CCTP bridges to preview rebalancer actions without executing live transactions.
- **NLP Swaps**: Conversational text commands (e.g., `Swap 10 USDC to EURC`) that are parsed and executed by the bot on the fly.

---

## 🏗️ Architecture

```
                    ┌──────────────────────────────┐
                    │      Telegram Interface      │
                    └──────────────┬───────────────┘
                                   │
                        ┌──────────▼──────────┐
                        │   Bot Service       │
                        └──────────┬──────────┘
                                   │
        ┌──────────────────────────┼──────────────────────────┐
        │                          │                          │
 ┌──────▼───────┐          ┌───────▼───────┐          ┌───────▼───────┐
 │ VaultService │          │  AgentService │          │  SwapService  │
 │ (ARC Vault)  │          │ (Cross-Chain) │          │ (Token Swaps) │
 └──────┬───────┘          └───────┬───────┘          └───────┬───────┘
        │                          │                          │
        └──────────────────────────┼──────────────────────────┘
                                   │
                        ┌──────────▼──────────┐
                        │    RelayService     │ (AppKit bridge & swap primitives)
                        └─────────────────────┘
```

---

## 📂 Project Structure

- `src/agent/`: Cross-chain drift detection, ingress/egress CCTP bridging scheduler (`AgentService`).
- `src/bot/`: Telegram Command/Button handlers and UI keyboard markups (`BotService`).
- `src/database/`: MongoDB schemas for users, sessions, snapshots, transactions, and rebalancing jobs.
- `src/price/`: Pricing engine retrieving token rates on ARC Testnet via swap estimates (`PriceService`).
- `src/relay/`: Primitives for same-chain swapping and cross-chain CCTP bridging (`RelayService`).
- `src/swap/`: Quote estimation, retry loops, slippage checks, and swap execution logic (`SwapService`).
- `src/vault/`: Portfolio balance syncing, valuation tracking, and historical snapshots (`VaultService`).
- `src/wallet/`: Creating EVM/SVM wallets and querying balances via Circle's W3S API (`WalletService`).

---

## 🚀 Getting Started

### 📋 Prerequisites

- Node.js (v18 or higher)
- [pnpm](https://pnpm.io/)
- MongoDB (local or Atlas URI)
- Circle Developer Account (API Key + Entity Secret)
- Telegram Bot Token

### 🔧 Installation

1. Clone the repository.
2. Navigate to the agent directory:
   ```bash
   cd arc-orbit_agent
   ```
3. Install dependencies:
   ```bash
   pnpm install
   ```

### ⚙️ Environment Configuration

Create a `.env` file in the `arc-orbit_agent` directory with the following variables:

```env
TELEGRAM_TOKEN=your_telegram_bot_token
MONGO_URI=your_mongodb_connection_string
CIRCLE_API_KEY=your_circle_api_key
CIRCLE_ENTITY_SECRET=your_circle_entity_secret
KIT_KEY=your_app_kit_key
```

### 🏃 Running the Application

To start the NestJS server in development watch mode:

```bash
pnpm run start:dev
```

To build for production:

```bash
pnpm run build
pnpm run start:prod
```
