import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../database/schemas/user.schema';
import {
  RebalanceJob,
  RebalanceJobDocument,
} from '../database/schemas/rebalance-job.schema';
import { VaultService } from '../vault/vault.service';
import { SwapService } from '../swap/swap.service';
import { PriceService } from '../price/price.service';

@Injectable()
export class RebalanceService implements OnModuleInit {
  private readonly logger = new Logger(RebalanceService.name);
  private isRebalancing = false;

  constructor(
    private readonly vaultService: VaultService,
    private readonly swapService: SwapService,
    private readonly priceService: PriceService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(RebalanceJob.name)
    private readonly jobModel: Model<RebalanceJob>,
  ) {}

  onModuleInit() {
    // Start automated rebalancing job every 2 minutes
    setInterval(() => this.runScheduledRebalancing(), 120 * 1000);
  }

  /**
   * Calculates the current drift for a user's portfolio.
   */
  async calculateDrift(chatId: number): Promise<{
    hasDrift: boolean;
    driftDetails: Array<{
      token: string;
      target: number;
      actual: number;
      drift: number;
    }>;
    totalValueUSD: string;
    balances: Record<string, string>;
    allocations: Record<string, number>;
  }> {
    const user = await this.userModel.findOne({ chatId });
    if (!user) throw new Error(`User not found: ${chatId}`);

    const sync = await this.vaultService.syncBalances(chatId);
    const targets = {
      USDC: user.allocationUsdc,
      EURC: user.allocationEurc,
      cirBTC: user.allocationCirbtc,
    };

    let hasDrift = false;
    const driftDetails = [];

    for (const token of ['USDC', 'EURC', 'cirBTC']) {
      const target = targets[token] ?? 0;
      const actual = sync.allocations[token] ?? 0;
      const drift = actual - target;

      driftDetails.push({
        token,
        target,
        actual,
        drift,
      });

      if (Math.abs(drift) > user.rebalanceThreshold) {
        hasDrift = true;
      }
    }

    return {
      hasDrift,
      driftDetails,
      totalValueUSD: sync.totalValueUSD,
      balances: sync.balances,
      allocations: sync.allocations,
    };
  }

  /**
   * Generates a rebalance plan containing the list of swaps to execute.
   */
  async generateRebalancePlan(
    chatId: number,
    dryRun = false,
  ): Promise<RebalanceJobDocument> {
    const user = await this.userModel.findOne({ chatId });
    if (!user) throw new Error(`User not found: ${chatId}`);

    const sync = await this.vaultService.syncBalances(chatId);
    const totalValueUSD = parseFloat(sync.totalValueUSD);

    const targets = {
      USDC: user.allocationUsdc,
      EURC: user.allocationEurc,
      cirBTC: user.allocationCirbtc,
    };

    const prices = {
      USDC: 1.0,
      EURC: await this.priceService.getPrice('EURC', user.evmWallet.address),
      cirBTC: await this.priceService.getPrice(
        'cirBTC',
        user.evmWallet.address,
      ),
    };

    const plannedSwaps: Array<{
      tokenIn: string;
      tokenOut: string;
      amount: string;
      reason: string;
    }> = [];

    if (totalValueUSD > 0) {
      // Calculate target USD values
      const targetValuesUSD = {
        USDC: totalValueUSD * (targets.USDC / 100),
        EURC: totalValueUSD * (targets.EURC / 100),
        cirBTC: totalValueUSD * (targets.cirBTC / 100),
      };

      // Calculate actual USD values
      const actualValuesUSD = {
        USDC: parseFloat(sync.valuations.USDC || '0'),
        EURC: parseFloat(sync.valuations.EURC || '0'),
        cirBTC: parseFloat(sync.valuations.cirBTC || '0'),
      };

      // Calculate differences
      const diffsUSD = {
        USDC: actualValuesUSD.USDC - targetValuesUSD.USDC,
        EURC: actualValuesUSD.EURC - targetValuesUSD.EURC,
        cirBTC: actualValuesUSD.cirBTC - targetValuesUSD.cirBTC,
      };

      // Step 1: Sell overweight non-USDC tokens first (into USDC)
      if (diffsUSD.EURC > 0) {
        const amountEurc = diffsUSD.EURC / prices.EURC;
        if (amountEurc >= 0.01) {
          plannedSwaps.push({
            tokenIn: 'EURC',
            tokenOut: 'USDC',
            amount: amountEurc.toFixed(6),
            reason: `EURC overweight by $${diffsUSD.EURC.toFixed(2)}`,
          });
        }
      }

      if (diffsUSD.cirBTC > 0) {
        const amountBtc = diffsUSD.cirBTC / prices.cirBTC;
        if (amountBtc >= 0.000001) {
          plannedSwaps.push({
            tokenIn: 'cirBTC',
            tokenOut: 'USDC',
            amount: amountBtc.toFixed(8),
            reason: `cirBTC overweight by $${diffsUSD.cirBTC.toFixed(2)}`,
          });
        }
      }

      // Step 2: Buy underweight non-USDC tokens using USDC
      if (diffsUSD.EURC < 0) {
        const amountUsdcNeeded = Math.abs(diffsUSD.EURC);
        if (amountUsdcNeeded >= 0.01) {
          plannedSwaps.push({
            tokenIn: 'USDC',
            tokenOut: 'EURC',
            amount: amountUsdcNeeded.toFixed(6),
            reason: `EURC underweight by $${amountUsdcNeeded.toFixed(2)}`,
          });
        }
      }

      if (diffsUSD.cirBTC < 0) {
        const amountUsdcNeeded = Math.abs(diffsUSD.cirBTC);
        if (amountUsdcNeeded >= 0.01) {
          plannedSwaps.push({
            tokenIn: 'USDC',
            tokenOut: 'cirBTC',
            amount: amountUsdcNeeded.toFixed(6),
            reason: `cirBTC underweight by $${amountUsdcNeeded.toFixed(2)}`,
          });
        }
      }
    }

    const job = await this.jobModel.create({
      chatId,
      status: dryRun ? 'PLANNED' : 'ANALYZING',
      dryRun,
      balancesBefore: new Map(Object.entries(sync.balances)),
      allocationsBefore: new Map(Object.entries(sync.allocations)),
      targetAllocations: new Map(Object.entries(targets)),
      plannedSwaps,
    });

    return job;
  }

  /**
   * Executes a planned rebalance job.
   */
  async executeRebalance(jobId: string): Promise<RebalanceJobDocument> {
    const job = await this.jobModel.findById(jobId);
    if (!job) throw new Error(`Rebalance job not found: ${jobId}`);

    if (job.status !== 'ANALYZING') {
      throw new Error(`Job is not in ANALYZING state (current: ${job.status})`);
    }

    job.status = 'EXECUTING';
    await job.save();

    this.logger.log(
      `Executing rebalance job ${jobId} for user ${job.chatId}...`,
    );
    const executedSwaps: typeof job.executedSwaps = [];

    try {
      for (const swap of job.plannedSwaps) {
        job.status = 'SWAPPING';
        await job.save();

        this.logger.log(
          `Executing rebalance swap: ${swap.amount} ${swap.tokenIn} -> ${swap.tokenOut}`,
        );
        const result = await this.swapService.executeSwap(
          job.chatId,
          swap.tokenIn,
          swap.tokenOut,
          swap.amount,
          { rebalanceJobId: job._id.toString() },
        );

        executedSwaps.push({
          tokenIn: swap.tokenIn,
          tokenOut: swap.tokenOut,
          amountIn: swap.amount,
          amountOut: result.amountOut,
          txHash: result.txHash || '',
          status: result.success ? 'COMPLETED' : 'FAILED',
          error: result.error,
        });

        if (!result.success) {
          throw new Error(`Rebalance swap failed: ${result.error}`);
        }
      }

      // Success
      const finalSync = await this.vaultService.syncBalances(job.chatId);
      await this.vaultService.takeSnapshot(job.chatId);

      job.status = 'COMPLETED';
      job.executedSwaps = executedSwaps;
      job.balancesAfter = new Map(Object.entries(finalSync.balances));
      await job.save();

      this.logger.log(`Rebalance job ${jobId} completed successfully.`);
    } catch (error) {
      this.logger.error(`Rebalance job ${jobId} failed: ${error.message}`);
      job.status = 'FAILED';
      job.executedSwaps = executedSwaps;
      job.error = error.message;
      await job.save();
    }

    return job;
  }

  /**
   * Automated job that runs on a schedule.
   */
  async runScheduledRebalancing() {
    if (this.isRebalancing) return;
    this.isRebalancing = true;

    try {
      const activeUsers = await this.userModel.find({ rebalanceEnabled: true });
      for (const user of activeUsers) {
        const { hasDrift } = await this.calculateDrift(user.chatId);
        if (hasDrift) {
          this.logger.log(
            `Drift detected for user ${user.chatId}. Initiating rebalance...`,
          );
          const job = await this.generateRebalancePlan(user.chatId, false);
          if (job.plannedSwaps.length > 0) {
            await this.executeRebalance(job._id.toString());
          } else {
            job.status = 'COMPLETED';
            await job.save();
          }
        }
      }
    } catch (error) {
      this.logger.error(`Scheduled rebalancing failed: ${error.message}`);
    } finally {
      this.isRebalancing = false;
    }
  }

  /**
   * Fetches rebalance history.
   */
  async getHistory(
    chatId: number,
    limit = 10,
  ): Promise<RebalanceJobDocument[]> {
    return this.jobModel.find({ chatId }).sort({ createdAt: -1 }).limit(limit);
  }
}
