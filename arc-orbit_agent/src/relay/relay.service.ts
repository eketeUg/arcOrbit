import {
  CircleWalletsAdapter,
  createCircleWalletsAdapter,
} from '@circle-fin/adapter-circle-wallets';
import {
  AppKit,
  BridgeChain,
  SwapChain,
  SwapResult,
} from '@circle-fin/app-kit';
import { Injectable } from '@nestjs/common';
import { inspect } from 'util';

@Injectable()
export class RelayService {
  private kit: AppKit;
  private adapter: CircleWalletsAdapter;

  constructor() {
    this.kit = new AppKit();
    this.adapter = createCircleWalletsAdapter({
      apiKey: process.env.CIRCLE_API_KEY!,
      entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
    });
  }

  async bridgeUSDC(
    fromChain: BridgeChain,
    toChain: BridgeChain,
    from: string,
    to: string,
    amount: string,
  ): Promise<
    | {
        name: string;
        state: string;
        txHash: string | null;
        explorerUrl: string | null;
      }[]
    | undefined
  > {
    try {
      const result = await this.kit.bridge({
        from: { adapter: this.adapter, chain: fromChain, address: from },
        to: { adapter: this.adapter, chain: toChain, address: to },
        amount,
        token: 'USDC',
      });

      console.log('RESULT', inspect(result, false, null, true));

      return result.steps.map((step: any) => ({
        name: step.name,
        state: step.state,
        txHash: step.txHash ?? null,
        explorerUrl: step.explorerUrl ?? null,
      }));
    } catch (error) {
      console.log('ERROR', inspect(error, false, null, true));
    }
  }

  async swapTokens(
    chain: SwapChain,
    from: string,
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
  ): Promise<SwapResult> {
    try {
      const result = await this.kit.swap({
        from: { adapter: this.adapter, chain, address: from },
        tokenIn,
        tokenOut,
        amountIn,
        config: { kitKey: process.env.KIT_KEY! },
      });
      console.log('RESULT', inspect(result, false, null, true));

      return result;
    } catch (error) {
      console.log('ERROR', inspect(error, false, null, true));
    }
  }

  async estimateSwap(
    chain: SwapChain,
    from: string,
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
  ) {
    try {
      const result = await this.kit.estimateSwap({
        from: { adapter: this.adapter, chain, address: from },
        tokenIn: tokenIn as any,
        tokenOut: tokenOut as any,
        amountIn,
        config: { kitKey: process.env.KIT_KEY! },
      });
      return result;
    } catch (error) {
      console.log('ERROR in estimateSwap', inspect(error, false, null, true));
      throw error;
    }
  }
}

// type ChainIdentifier$1 = ChainDefinition | "Arbitrum" | "Avalanche" | "Base" | "Codex" | "Edge" | "Ethereum" | "HyperEVM" | "Injective" | "Ink" | "Linea" | "Monad" | "Morph" | "Optimism" | "Pharos" | "Plume" | "Polygon" | "Sei" | "Solana" | "Sonic" | "Unichain" | "World_Chain" | "XDC" | "Arc_Testnet" | "Arbitrum_Sepolia" | "Avalanche_Fuji" | "Base_Sepolia" | "Codex_Testnet" | "Edge_Testnet" | "Ethereum_Sepolia" | "HyperEVM_Testnet" | "Injective_Testnet" | "Ink_Testnet" | "Linea_Sepolia" | "Monad_Testnet" | "Morph_Testnet" | "Optimism_Sepolia" | ... 29 more ... | "ZKSync_Sepolia"
