import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../database/schemas/user.schema';
import { WalletService } from '../wallet/wallet.service';
import { RelayService } from '../relay/relay.service';
import { VaultService } from '../vault/vault.service';
import { BridgeChain } from '@circle-fin/app-kit';

@Injectable()
export class AgentService implements OnModuleInit {
  private readonly logger = new Logger(AgentService.name);
  private isBridging = false;

  constructor(
    private readonly walletService: WalletService,
    private readonly relayService: RelayService,
    private readonly vaultService: VaultService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
  ) {}

  onModuleInit() {
    // Run cross-chain rebalancing cron job every 2 minutes
    setInterval(() => this.runScheduledRebalancing(), 120 * 1000);
  }

  /**
   * Calculates drift across Base Sepolia, Solana Devnet, and ARC Testnet.
   */
  async calculateCrossChainDrift(chatId: number): Promise<{
    hasDrift: boolean;
    totalUSDC: string;
    balances: { Base: string; Solana: string; ARC: string };
    allocations: { Base: number; Solana: number; ARC: number };
    driftDetails: Array<{ chain: string; target: number; actual: number; drift: number }>;
  }> {
    const user = await this.userModel.findOne({ chatId });
    if (!user) throw new Error(`User not found: ${chatId}`);

    // Fetch USDC balances on all 3 chains
    const [balanceBase, balanceSolana, balanceArc] = await Promise.all([
      this.walletService.getUSDCBalanceOnChain(user.evmWallet.address, 'BASE-SEPOLIA'),
      this.walletService.getUSDCBalanceOnChain(user.svmWallet.address, 'SOL-DEVNET'),
      this.walletService.getUSDCBalanceOnChain(user.evmWallet.address, 'ARC-TESTNET'),
    ]);

    const valBase = parseFloat(balanceBase);
    const valSolana = parseFloat(balanceSolana);
    const valArc = parseFloat(balanceArc);

    const totalUSDC = valBase + valSolana + valArc;

    const allocations = {
      Base: totalUSDC > 0 ? (valBase / totalUSDC) * 100 : 0,
      Solana: totalUSDC > 0 ? (valSolana / totalUSDC) * 100 : 0,
      ARC: totalUSDC > 0 ? (valArc / totalUSDC) * 100 : 0,
    };

    const targets = {
      Base: user.allocationBase,
      Solana: user.allocationSolana,
      ARC: user.allocationArc,
    };

    let hasDrift = false;
    const driftDetails = [];

    for (const chain of ['Base', 'Solana', 'ARC']) {
      const target = targets[chain] ?? 0;
      const actual = allocations[chain] ?? 0;
      const drift = actual - target;

      driftDetails.push({
        chain,
        target,
        actual,
        drift,
      });

      if (Math.abs(drift) > user.crossChainThreshold) {
        hasDrift = true;
      }
    }

    return {
      hasDrift,
      totalUSDC: totalUSDC.toFixed(2),
      balances: { Base: balanceBase, Solana: balanceSolana, ARC: balanceArc },
      allocations,
      driftDetails,
    };
  }

  /**
   * Coordinates CCTP bridging to rebalance USDC across chains.
   */
  async rebalanceCrossChain(
    chatId: number,
    dryRun = false,
  ): Promise<{
    success: boolean;
    executedBridges: Array<{
      from: string;
      to: string;
      amount: string;
      reason: string;
      txHash?: string;
      status: string;
    }>;
    error?: string;
  }> {
    const user = await this.userModel.findOne({ chatId });
    if (!user) throw new Error(`User not found: ${chatId}`);

    const drift = await this.calculateCrossChainDrift(chatId);
    const totalUSDC = parseFloat(drift.totalUSDC);

    const targets = {
      Base: user.allocationBase,
      Solana: user.allocationSolana,
      ARC: user.allocationArc,
    };

    const actualUSDC = {
      Base: parseFloat(drift.balances.Base),
      Solana: parseFloat(drift.balances.Solana),
      ARC: parseFloat(drift.balances.ARC),
    };

    const executedBridges: any[] = [];

    if (totalUSDC <= 0) {
      return { success: true, executedBridges, error: 'Total USDC balance is zero.' };
    }

    // Target balance in USDC for each chain
    const targetBalances = {
      Base: totalUSDC * (targets.Base / 100),
      Solana: totalUSDC * (targets.Solana / 100),
      ARC: totalUSDC * (targets.ARC / 100),
    };

    const diffs = {
      Base: actualUSDC.Base - targetBalances.Base,
      Solana: actualUSDC.Solana - targetBalances.Solana,
      ARC: actualUSDC.ARC - targetBalances.ARC,
    };

    this.logger.log(`Cross-chain diffs: ${JSON.stringify(diffs)}`);

    try {
      // Step 1: Ingress (bridge excess USDC from Base and Solana into ARC)
      if (diffs.Base > 1.0) {
        const bridgeAmount = diffs.Base.toFixed(6);
        const reason = `Base overweight by $${diffs.Base.toFixed(2)}`;
        if (dryRun) {
          executedBridges.push({
            from: 'Base Sepolia',
            to: 'ARC Testnet',
            amount: bridgeAmount,
            reason,
            status: 'PLANNED',
          });
        } else {
          this.logger.log(`Ingressing ${bridgeAmount} USDC from Base to ARC...`);
          const result = await this.relayService.bridgeUSDC(
            BridgeChain.Base_Sepolia,
            BridgeChain.Arc_Testnet,
            user.evmWallet.address,
            user.evmWallet.address,
            bridgeAmount,
          );

          const txHash = result?.[0]?.txHash || '';
          executedBridges.push({
            from: 'Base Sepolia',
            to: 'ARC Testnet',
            amount: bridgeAmount,
            reason,
            txHash,
            status: txHash ? 'COMPLETED' : 'FAILED',
          });

          await this.vaultService.recordTransaction({
            chatId,
            type: 'DEPOSIT',
            tokenIn: 'USDC',
            tokenOut: 'USDC',
            amountIn: bridgeAmount,
            amountOut: bridgeAmount,
            txHash,
            status: txHash ? 'COMPLETED' : 'FAILED',
          });
        }
      }

      if (diffs.Solana > 1.0) {
        const bridgeAmount = diffs.Solana.toFixed(6);
        const reason = `Solana overweight by $${diffs.Solana.toFixed(2)}`;
        if (dryRun) {
          executedBridges.push({
            from: 'Solana Devnet',
            to: 'ARC Testnet',
            amount: bridgeAmount,
            reason,
            status: 'PLANNED',
          });
        } else {
          this.logger.log(`Ingressing ${bridgeAmount} USDC from Solana to ARC...`);
          const result = await this.relayService.bridgeUSDC(
            BridgeChain.Solana_Devnet,
            BridgeChain.Arc_Testnet,
            user.svmWallet.address,
            user.evmWallet.address,
            bridgeAmount,
          );

          const txHash = result?.[0]?.txHash || '';
          executedBridges.push({
            from: 'Solana Devnet',
            to: 'ARC Testnet',
            amount: bridgeAmount,
            reason,
            txHash,
            status: txHash ? 'COMPLETED' : 'FAILED',
          });

          await this.vaultService.recordTransaction({
            chatId,
            type: 'DEPOSIT',
            tokenIn: 'USDC',
            tokenOut: 'USDC',
            amountIn: bridgeAmount,
            amountOut: bridgeAmount,
            txHash,
            status: txHash ? 'COMPLETED' : 'FAILED',
          });
        }
      }

      // Step 2: Egress (bridge USDC from ARC treasury out to Base and Solana if underweight)
      if (diffs.Base < -1.0) {
        const bridgeAmount = Math.abs(diffs.Base).toFixed(6);
        const reason = `Base underweight by $${Math.abs(diffs.Base).toFixed(2)}`;
        if (dryRun) {
          executedBridges.push({
            from: 'ARC Testnet',
            to: 'Base Sepolia',
            amount: bridgeAmount,
            reason,
            status: 'PLANNED',
          });
        } else {
          this.logger.log(`Egressing ${bridgeAmount} USDC from ARC to Base...`);
          const result = await this.relayService.bridgeUSDC(
            BridgeChain.Arc_Testnet,
            BridgeChain.Base_Sepolia,
            user.evmWallet.address,
            user.evmWallet.address,
            bridgeAmount,
          );

          const txHash = result?.[0]?.txHash || '';
          executedBridges.push({
            from: 'ARC Testnet',
            to: 'Base Sepolia',
            amount: bridgeAmount,
            reason,
            txHash,
            status: txHash ? 'COMPLETED' : 'FAILED',
          });

          await this.vaultService.recordTransaction({
            chatId,
            type: 'WITHDRAWAL',
            tokenIn: 'USDC',
            tokenOut: 'USDC',
            amountIn: bridgeAmount,
            amountOut: bridgeAmount,
            txHash,
            status: txHash ? 'COMPLETED' : 'FAILED',
          });
        }
      }

      if (diffs.Solana < -1.0) {
        const bridgeAmount = Math.abs(diffs.Solana).toFixed(6);
        const reason = `Solana underweight by $${Math.abs(diffs.Solana).toFixed(2)}`;
        if (dryRun) {
          executedBridges.push({
            from: 'ARC Testnet',
            to: 'Solana Devnet',
            amount: bridgeAmount,
            reason,
            status: 'PLANNED',
          });
        } else {
          this.logger.log(`Egressing ${bridgeAmount} USDC from ARC to Solana...`);
          const result = await this.relayService.bridgeUSDC(
            BridgeChain.Arc_Testnet,
            BridgeChain.Solana_Devnet,
            user.evmWallet.address,
            user.svmWallet.address,
            bridgeAmount,
          );

          const txHash = result?.[0]?.txHash || '';
          executedBridges.push({
            from: 'ARC Testnet',
            to: 'Solana Devnet',
            amount: bridgeAmount,
            reason,
            txHash,
            status: txHash ? 'COMPLETED' : 'FAILED',
          });

          await this.vaultService.recordTransaction({
            chatId,
            type: 'WITHDRAWAL',
            tokenIn: 'USDC',
            tokenOut: 'USDC',
            amountIn: bridgeAmount,
            amountOut: bridgeAmount,
            txHash,
            status: txHash ? 'COMPLETED' : 'FAILED',
          });
        }
      }

      return { success: true, executedBridges };
    } catch (err) {
      this.logger.error(`Error executing cross chain rebalancing: ${err.message}`);
      return { success: false, executedBridges, error: err.message };
    }
  }

  /**
   * Automated rebalancing runner checking active users.
   */
  async runScheduledRebalancing() {
    if (this.isBridging) return;
    this.isBridging = true;

    try {
      const activeUsers = await this.userModel.find({ crossChainRebalanceEnabled: true });
      for (const user of activeUsers) {
        const drift = await this.calculateCrossChainDrift(user.chatId);
        if (drift.hasDrift) {
          this.logger.log(`Cross-chain drift detected for user ${user.chatId}. Triggering bridges...`);
          await this.rebalanceCrossChain(user.chatId, false);
        }
      }
    } catch (error) {
      this.logger.error(`Scheduled cross-chain rebalancing failed: ${error.message}`);
    } finally {
      this.isBridging = false;
    }
  }
}
