import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../database/schemas/user.schema';
import { RelayService } from '../relay/relay.service';
import { VaultService } from '../vault/vault.service';
import { SwapChain, SwapResult, Blockchain } from '@circle-fin/app-kit';

@Injectable()
export class SwapService {
  private readonly logger = new Logger(SwapService.name);

  // Supported routes
  private readonly validRoutes = new Set<string>([
    'USDC-EURC',
    'EURC-USDC',
    'USDC-cirBTC',
    'cirBTC-USDC',
    'EURC-cirBTC',
    'cirBTC-EURC',
  ]);

  constructor(
    private readonly relayService: RelayService,
    private readonly vaultService: VaultService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  /**
   * Validates if a swap route is supported.
   */
  isValidRoute(tokenIn: string, tokenOut: string): boolean {
    const route = `${tokenIn}-${tokenOut}`;
    return this.validRoutes.has(route);
  }

  /**
   * Estimates the output and fees for a swap without executing it.
   */
  async estimateSwap(
    chatId: number,
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
  ) {
    const user = await this.userModel.findOne({ chatId });
    if (!user || !user.evmWallet?.address) {
      throw new Error(`User EVM wallet not found for chatId: ${chatId}`);
    }

    const tIn = tokenIn === 'cirBTC' ? 'cirBTC' : tokenIn.toUpperCase();
    const tOut = tokenOut === 'cirBTC' ? 'cirBTC' : tokenOut.toUpperCase();

    if (!this.isValidRoute(tIn, tOut)) {
      throw new Error(`Unsupported swap route: ${tIn} to ${tOut}`);
    }

    return this.relayService.estimateSwap(
      SwapChain.Arc_Testnet,
      user.evmWallet.address,
      tIn,
      tOut,
      amountIn,
    );
  }

  /**
   * Executes a swap on Arc Testnet with retry logic and transaction logging.
   */
  async executeSwap(
    chatId: number,
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    options?: { maxSlippageBps?: number; rebalanceJobId?: string },
  ): Promise<
    SwapResult & { attempts: number; success: boolean; error?: string }
  > {
    const user = await this.userModel.findOne({ chatId });
    if (!user || !user.evmWallet?.address) {
      throw new Error(`User EVM wallet not found for chatId: ${chatId}`);
    }

    const tIn = tokenIn === 'cirBTC' ? 'cirBTC' : tokenIn.toUpperCase();
    const tOut = tokenOut === 'cirBTC' ? 'cirBTC' : tokenOut.toUpperCase();

    if (!this.isValidRoute(tIn, tOut)) {
      throw new Error(`Unsupported swap route: ${tIn} to ${tOut}`);
    }

    // 1. Estimate first for slippage / validation check
    let estimate;
    try {
      estimate = await this.estimateSwap(chatId, tIn, tOut, amountIn);
      this.logger.log(
        `Estimated output for ${amountIn} ${tIn} -> ${estimate.estimatedOutput.amount} ${tOut}`,
      );
    } catch (err) {
      this.logger.error(`Swap estimation failed: ${err.message}`);
      throw new Error(`Estimation failed before swap: ${err.message}`);
    }

    // Record pending transaction
    const txLog = await this.vaultService.recordTransaction({
      chatId,
      type: options?.rebalanceJobId ? 'REBALANCE_SWAP' : 'SWAP',
      tokenIn: tIn,
      tokenOut: tOut,
      amountIn,
      amountOut: estimate.estimatedOutput.amount,
      status: 'PENDING',
      rebalanceJobId: options?.rebalanceJobId,
    });

    const maxRetries = 3;
    let attempts = 0;
    let swapResult: SwapResult | null = null;
    let lastError: Error | null = null;

    // Retry loop with backoff
    while (attempts < maxRetries) {
      attempts++;
      try {
        this.logger.log(`Attempt ${attempts}/${maxRetries} executing swap...`);
        swapResult = await this.relayService.swapTokens(
          SwapChain.Arc_Testnet,
          user.evmWallet.address,
          tIn,
          tOut,
          amountIn,
        );

        if (swapResult && swapResult.txHash) {
          // Success!
          txLog.status = 'COMPLETED';
          txLog.txHash = swapResult.txHash;
          txLog.explorerUrl = swapResult.explorerUrl || '';
          txLog.amountOut =
            swapResult.amountOut || estimate.estimatedOutput.amount;
          await txLog.save();

          // Sync balances
          await this.vaultService.syncBalances(chatId);

          return {
            ...swapResult,
            attempts,
            success: true,
          };
        } else {
          throw new Error('Swap call returned empty transaction hash');
        }
      } catch (error) {
        lastError = error;
        this.logger.warn(`Attempt ${attempts} failed: ${error.message}`);
        if (attempts < maxRetries) {
          // Exponential backoff: wait 2s, 4s
          await new Promise((resolve) => setTimeout(resolve, attempts * 2000));
        }
      }
    }

    // If we reach here, swap failed
    const errorMsg = lastError?.message || 'Unknown swap execution error';
    txLog.status = 'FAILED';
    txLog.error = errorMsg;
    await txLog.save();

    return {
      tokenIn: tIn,
      tokenOut: tOut,
      chain: Blockchain.Arc_Testnet,
      amountIn,
      fromAddress: user.evmWallet.address,
      amountOut: '0',
      toAddress: user.evmWallet.address,
      txHash: null,
      explorerUrl: null,
      fees: [] as any,
      attempts,
      success: false,
      error: errorMsg,
    };
  }
}
