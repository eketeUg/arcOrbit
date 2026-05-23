import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../database/schemas/user.schema';
import { VaultSnapshot, VaultSnapshotDocument } from '../database/schemas/vault-snapshot.schema';
import { VaultTransaction, VaultTransactionDocument } from '../database/schemas/vault-transaction.schema';
import { WalletService } from '../wallet/wallet.service';
import { PriceService } from '../price/price.service';

@Injectable()
export class VaultService {
  private readonly logger = new Logger(VaultService.name);

  constructor(
    private readonly walletService: WalletService,
    private readonly priceService: PriceService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(VaultSnapshot.name) private readonly snapshotModel: Model<VaultSnapshot>,
    @InjectModel(VaultTransaction.name) private readonly transactionModel: Model<VaultTransaction>,
  ) {}

  /**
   * Syncs the on-chain balances for the user's EVM wallet on ARC-TESTNET.
   * Calculates the USD valuation of the portfolio.
   */
  async syncBalances(chatId: number): Promise<{
    balances: Record<string, string>;
    valuations: Record<string, string>;
    totalValueUSD: string;
    allocations: Record<string, number>;
  }> {
    const user = await this.userModel.findOne({ chatId });
    if (!user) {
      throw new Error(`User not found for chatId: ${chatId}`);
    }

    if (!user.evmWallet?.id) {
      throw new Error(`EVM wallet not configured for user: ${chatId}`);
    }

    this.logger.log(`Syncing balances for user ${chatId}...`);
    const tokenBalances = await this.walletService.getWalletBalances(user.evmWallet.id);

    const balances: Record<string, string> = {
      USDC: '0',
      EURC: '0',
      cirBTC: '0',
    };

    // Extract USDC, EURC, cirBTC balances
    for (const item of tokenBalances) {
      const symbol = item.token?.symbol?.toUpperCase();
      if (symbol === 'USDC' || symbol === 'EURC' || symbol === 'CIRBTC') {
        balances[symbol === 'CIRBTC' ? 'cirBTC' : symbol] = item.amount || '0';
      }
    }

    // Get USD prices
    const [priceUsdc, priceEurc, priceCirbtc] = await Promise.all([
      this.priceService.getPrice('USDC', user.evmWallet.address),
      this.priceService.getPrice('EURC', user.evmWallet.address),
      this.priceService.getPrice('cirBTC', user.evmWallet.address),
    ]);

    const valUsdc = parseFloat(balances.USDC) * priceUsdc;
    const valEurc = parseFloat(balances.EURC) * priceEurc;
    const valCirbtc = parseFloat(balances.cirBTC) * priceCirbtc;

    const totalVal = valUsdc + valEurc + valCirbtc;

    const valuations: Record<string, string> = {
      USDC: valUsdc.toFixed(2),
      EURC: valEurc.toFixed(2),
      cirBTC: valCirbtc.toFixed(2),
    };

    const allocations: Record<string, number> = {
      USDC: totalVal > 0 ? (valUsdc / totalVal) * 100 : 0,
      EURC: totalVal > 0 ? (valEurc / totalVal) * 100 : 0,
      cirBTC: totalVal > 0 ? (valCirbtc / totalVal) * 100 : 0,
    };

    return {
      balances,
      valuations,
      totalValueUSD: totalVal.toFixed(2),
      allocations,
    };
  }

  /**
   * Captures a snapshot of the user's current portfolio state and saves it.
   */
  async takeSnapshot(chatId: number): Promise<VaultSnapshotDocument> {
    const user = await this.userModel.findOne({ chatId });
    if (!user) {
      throw new Error(`User not found for snapshot: ${chatId}`);
    }

    const { balances, valuations, totalValueUSD, allocations } = await this.syncBalances(chatId);

    const targetAllocations = new Map<string, number>([
      ['USDC', user.allocationUsdc],
      ['EURC', user.allocationEurc],
      ['cirBTC', user.allocationCirbtc],
    ]);

    const snapshot = await this.snapshotModel.create({
      chatId,
      balances: new Map(Object.entries(balances)),
      valuations: new Map(Object.entries(valuations)),
      totalValueUSD,
      allocations: new Map(Object.entries(allocations)),
      targetAllocations,
    });

    this.logger.log(`Saved portfolio snapshot for user ${chatId} (Total: $${totalValueUSD})`);
    return snapshot;
  }

  /**
   * Logs a vault transaction (deposit, withdrawal, swap, rebalance swap).
   */
  async recordTransaction(params: {
    chatId: number;
    type: 'DEPOSIT' | 'WITHDRAWAL' | 'SWAP' | 'REBALANCE_SWAP';
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    amountOut: string;
    txHash?: string;
    explorerUrl?: string;
    status: 'PENDING' | 'COMPLETED' | 'FAILED';
    error?: string;
    rebalanceJobId?: string;
  }): Promise<VaultTransactionDocument> {
    return this.transactionModel.create(params);
  }

  /**
   * Fetches the recent transactions for a user.
   */
  async getTransactions(chatId: number, limit = 10): Promise<VaultTransactionDocument[]> {
    return this.transactionModel
      .find({ chatId })
      .sort({ createdAt: -1 })
      .limit(limit);
  }

  /**
   * Fetches recent snapshots.
   */
  async getSnapshots(chatId: number, limit = 10): Promise<VaultSnapshotDocument[]> {
    return this.snapshotModel
      .find({ chatId })
      .sort({ createdAt: -1 })
      .limit(limit);
  }
}
