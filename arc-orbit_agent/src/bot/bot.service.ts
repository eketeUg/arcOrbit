import { Injectable, Logger } from '@nestjs/common';
import * as TelegramBot from 'node-telegram-bot-api';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from '../database/schemas/user.schema';
import {
  allFeaturesMarkup,
  welcomeMessageMarkup,
  showPortfolioMarkup,
  showBalanceMarkup,
  walletFeaturesMarkup,
  swapResultMarkup,
  crossChainMarkup,
} from './markups';
import { WalletService } from 'src/wallet/wallet.service';
import { Session, SessionDocument } from 'src/database/schemas/session.schema';
import { UserService } from 'src/user/user.service';
import { SwapChain } from '@circle-fin/app-kit';
import { RelayService } from 'src/relay/relay.service';
import { VaultService } from '../vault/vault.service';
import { SwapService } from '../swap/swap.service';
import { RebalanceService } from '../rebalance/rebalance.service';
import { PriceService } from '../price/price.service';
import { AgentService } from '../agent/agent.service';

const token = process.env.TELEGRAM_TOKEN;

@Injectable()
export class BotService {
  private bot: TelegramBot;
  private logger = new Logger(BotService.name);

  constructor(
    private readonly walletService: WalletService,
    private readonly relayService: RelayService,
    private readonly userService: UserService,
    private readonly vaultService: VaultService,
    private readonly swapService: SwapService,
    private readonly rebalanceService: RebalanceService,
    private readonly priceService: PriceService,
    private readonly agentService: AgentService,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Session.name) private readonly sessionModel: Model<Session>,
  ) {
    this.bot = new TelegramBot(token, { polling: true });
    this.bot.on('message', this.handleRecievedMessages);
    this.bot.on('callback_query', this.handleButtonCommands);
  }

  handleRecievedMessages = async (msg: any) => {
    this.logger.debug(msg);
    if (!msg.text) return;

    try {
      await this.bot.sendChatAction(msg.chat.id, 'typing');

      const [user, session] = await Promise.all([
        this.userModel.findOne({ chatId: msg.chat.id }),
        this.sessionModel.findOne({ chatId: msg.chat.id }),
      ]);

      const text = msg.text.trim();

      // Handle start command
      if (text === '/start') {
        const username = msg.from.username || msg.from.first_name || 'User';
        await this.userService.findOrCreateTelegramUser({
          chatId: msg.chat.id,
          username,
        });

        const welcome = await welcomeMessageMarkup(username);
        await this.bot.sendMessage(msg.chat.id, welcome.message, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: welcome.keyboard,
          },
        });
        return;
      }

      // Handle menu command
      if (text === '/menu') {
        await this.sendAllFeature(user);
        return;
      }

      // Handle text inputs if not a command
      if (msg.text !== '/start' && msg.text !== '/menu' && session) {
        return this.handleUserTextInputs(msg, session!);
      }

      // Handle conversational / NLP swap command: "Swap 10 USDC to EURC"
      const swapRegex =
        /^Swap\s+(\d+(?:\.\d+)?)\s+(\w+)\s+(?:to|for)\s+(\w+)$/i;
      const match = text.match(swapRegex);

      if (match) {
        const amount = match[1];
        const tokenIn = match[2].toUpperCase();
        const tokenOut = match[3].toUpperCase();

        if (!user) {
          await this.bot.sendMessage(
            msg.chat.id,
            '⚠️ Please run /start first to initialize your account.',
          );
          return;
        }

        if (!this.swapService.isValidRoute(tokenIn, tokenOut)) {
          await this.bot.sendMessage(
            msg.chat.id,
            `⚠️ Unsupported route. Valid swaps: USDC ↔ EURC, USDC ↔ cirBTC, EURC ↔ cirBTC.`,
          );
          return;
        }

        await this.bot.sendMessage(
          msg.chat.id,
          `🔀 Initiating swap of <b>${amount} ${tokenIn}</b> for <b>${tokenOut}</b> on Arc Testnet...`,
          { parse_mode: 'HTML' },
        );

        const result = await this.swapService.executeSwap(
          msg.chat.id,
          tokenIn,
          tokenOut,
          amount,
        );

        if (result.success) {
          const markup = await swapResultMarkup(result);
          await this.bot.sendMessage(msg.chat.id, markup.message, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: markup.keyboard },
          });
        } else {
          await this.bot.sendMessage(
            msg.chat.id,
            `❌ Swap execution failed: <code>${result.error}</code>`,
            { parse_mode: 'HTML' },
          );
        }
        return;
      }

      // Fallback message
      await this.bot.sendMessage(
        msg.chat.id,
        '💡 Try using the buttons in the menu or type a command like: `Swap 10 USDC to EURC`',
        { parse_mode: 'Markdown' },
      );
    } catch (error) {
      this.logger.error('Error in handleReceivedMessages:', error);
    }
  };

  handleButtonCommands = async (query: any) => {
    this.logger.debug(query);
    let command: string;

    function isJSON(str) {
      try {
        JSON.parse(str);
        return true;
      } catch (e) {
        return false;
      }
    }

    if (isJSON(query.data)) {
      command = JSON.parse(query.data).command;
    } else {
      command = query.data;
    }

    const chatId = query.message.chat.id;

    try {
      await this.bot.sendChatAction(chatId, 'typing');
      const user = await this.userModel.findOne({ chatId: chatId });
      if (!user) return;

      switch (command) {
        case '/menu':
          await this.bot.deleteMessage(chatId, query.message.message_id);
          await this.sendAllFeature(user);
          return;

        case '/portfolioOverview': {
          const sync = await this.vaultService.syncBalances(chatId);
          const targets = {
            USDC: user.allocationUsdc,
            EURC: user.allocationEurc,
            cirBTC: user.allocationCirbtc,
          };

          const assets = await Promise.all(
            ['USDC', 'EURC', 'cirBTC'].map(async (token) => {
              const priceUSD = await this.priceService.getPrice(
                token,
                user.evmWallet.address,
              );
              const balance = sync.balances[token] || '0';
              const valueUSD = sync.valuations[token] || '0';
              const actualPct = sync.allocations[token] || 0;
              const targetPct = targets[token] || 0;

              return {
                token,
                balance,
                valueUSD,
                priceUSD,
                actualPct,
                targetPct,
              };
            }),
          );

          const markup = await showPortfolioMarkup({
            chatId,
            totalValueUSD: sync.totalValueUSD,
            rebalanceEnabled: user.rebalanceEnabled,
            rebalanceThreshold: user.rebalanceThreshold,
            assets,
          });

          await this.bot.sendMessage(chatId, markup.message, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: markup.keyboard },
          });
          return;
        }

        case '/walletFeatures': {
          const markup = await walletFeaturesMarkup();
          await this.bot.sendMessage(chatId, markup.message, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: markup.keyboard },
          });
          return;
        }

        case '/checkBalance': {
          const sync = await this.vaultService.syncBalances(chatId);
          const markup = await showBalanceMarkup({
            USDC: sync.balances.USDC,
            EURC: sync.balances.EURC,
            cirBTC: sync.balances.cirBTC,
          });
          await this.bot.sendMessage(chatId, markup.message, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: markup.keyboard },
          });
          return;
        }

        case '/fundWallet':
          await this.bot.sendMessage(
            chatId,
            `📥 <b>Deposit Funds to Your Vault:</b>\n\n` +
              `• <b>EVM (ARC/Base) Address:</b>\n<code>${user.evmWallet.address}</code>\n\n` +
              `• <b>Solana Address:</b>\n<code>${user.svmWallet.address}</code>\n\n` +
              `Send <b>USDC</b>, <b>EURC</b>, or <b>cirBTC</b> to either address. If you send USDC to Base or Solana, our ingress rebalancer will route it to ARC Testnet automatically.`,
            { parse_mode: 'HTML' },
          );
          return;

        case '/setTargetAllocation':
          await this.sessionModel.deleteMany({ chatId });
          await this.sessionModel.create({
            chatId,
            allocationSetting: true,
            sessionOn: true,
          });
          await this.bot.sendMessage(
            chatId,
            `🎯 <b>Set Portfolio Target Allocation</b>\n\nPlease enter the target allocations for <code>USDC</code>, <code>EURC</code>, and <code>cirBTC</code> separated by spaces (e.g. <code>50 30 20</code>):\n\n<i>Note: The sum of allocations must equal exactly 100%.</i>`,
            { parse_mode: 'HTML' },
          );
          return;

        case '/setThreshold':
          await this.sessionModel.deleteMany({ chatId });
          await this.sessionModel.create({
            chatId,
            thresholdSetting: true,
            sessionOn: true,
          });
          await this.bot.sendMessage(
            chatId,
            `🔼 <b>Set Rebalance Threshold</b>\n\nPlease enter your deviation threshold percentage (e.g. <code>5</code> for 5% drift):`,
            { parse_mode: 'HTML' },
          );
          return;

        case '/enableRebalance':
          user.rebalanceEnabled = !user.rebalanceEnabled;
          await user.save();
          await this.bot.sendMessage(
            chatId,
            `🤖 Auto-rebalancing is now <b>${user.rebalanceEnabled ? '✅ Enabled' : '❌ Disabled'}</b>.`,
            { parse_mode: 'HTML' },
          );
          return;

        case '/rebalanceNow': {
          await this.bot.sendMessage(chatId, '🔍 Analyzing portfolio drift...');
          const job = await this.rebalanceService.generateRebalancePlan(
            chatId,
            false,
          );

          if (job.plannedSwaps.length === 0) {
            await this.bot.sendMessage(
              chatId,
              '✅ Your portfolio allocations are healthy. No swaps needed.',
            );
            return;
          }

          let planDesc = '🔄 <b>Planned Rebalancing Swaps:</b>\n\n';
          for (const s of job.plannedSwaps) {
            planDesc += `• Swap ${s.amount} <b>${s.tokenIn}</b> ➔ <b>${s.tokenOut}</b> (${s.reason})\n`;
          }
          await this.bot.sendMessage(chatId, planDesc, { parse_mode: 'HTML' });

          await this.bot.sendMessage(
            chatId,
            '⚙️ Executing on-chain swaps on Arc...',
          );
          const executed = await this.rebalanceService.executeRebalance(
            job._id.toString(),
          );

          if (executed.status === 'COMPLETED') {
            await this.bot.sendMessage(
              chatId,
              '✅ <b>Rebalancing completed successfully!</b>',
              { parse_mode: 'HTML' },
            );
          } else {
            await this.bot.sendMessage(
              chatId,
              `❌ <b>Rebalancing failed:</b> <code>${executed.error || 'Unknown execution error'}</code>`,
              { parse_mode: 'HTML' },
            );
          }
          return;
        }

        case '/dryRunRebalance': {
          const job = await this.rebalanceService.generateRebalancePlan(
            chatId,
            true,
          );
          if (job.plannedSwaps.length === 0) {
            await this.bot.sendMessage(
              chatId,
              '🔬 [Simulation] Portfolio is balanced. No actions planned.',
            );
            return;
          }

          let planDesc = '🔬 <b>Rebalance Simulation Plan (Dry Run):</b>\n\n';
          for (const s of job.plannedSwaps) {
            planDesc += `• Sell <b>${s.amount} ${s.tokenIn}</b> for <b>${s.tokenOut}</b> (${s.reason})\n`;
          }
          planDesc += `\n<i>No on-chain trades were executed.</i>`;
          await this.bot.sendMessage(chatId, planDesc, { parse_mode: 'HTML' });
          return;
        }

        case '/crossChainOverview': {
          const drift =
            await this.agentService.calculateCrossChainDrift(chatId);
          const chains = [
            {
              name: 'Base Sepolia',
              balance: drift.balances.Base,
              actualPct: drift.allocations.Base,
              targetPct: user.allocationBase,
              drift:
                drift.driftDetails.find((d) => d.chain === 'Base')?.drift ?? 0,
            },
            {
              name: 'Solana Devnet',
              balance: drift.balances.Solana,
              actualPct: drift.allocations.Solana,
              targetPct: user.allocationSolana,
              drift:
                drift.driftDetails.find((d) => d.chain === 'Solana')?.drift ??
                0,
            },
            {
              name: 'ARC Testnet',
              balance: drift.balances.ARC,
              actualPct: drift.allocations.ARC,
              targetPct: user.allocationArc,
              drift:
                drift.driftDetails.find((d) => d.chain === 'ARC')?.drift ?? 0,
            },
          ];

          const markup = await crossChainMarkup({
            totalUSDC: drift.totalUSDC,
            crossChainRebalanceEnabled: user.crossChainRebalanceEnabled,
            crossChainThreshold: user.crossChainThreshold,
            chains,
          });

          await this.bot.sendMessage(chatId, markup.message, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: markup.keyboard },
          });
          return;
        }

        case '/setCrossChainAllocation':
          await this.sessionModel.deleteMany({ chatId });
          await this.sessionModel.create({
            chatId,
            crossChainAllocationSetting: true,
            sessionOn: true,
          });
          await this.bot.sendMessage(
            chatId,
            `🎯 <b>Set Cross-Chain USDC Target Allocation</b>\n\nPlease enter the target splits for <code>Base Sepolia</code>, <code>Solana Devnet</code>, and <code>ARC Testnet</code> separated by spaces (e.g. <code>33 33 34</code>):\n\n<i>Note: The sum of allocations must equal exactly 100%.</i>`,
            { parse_mode: 'HTML' },
          );
          return;

        case '/setCrossChainThreshold':
          await this.sessionModel.deleteMany({ chatId });
          await this.sessionModel.create({
            chatId,
            crossChainThresholdSetting: true,
            sessionOn: true,
          });
          await this.bot.sendMessage(
            chatId,
            `🔼 <b>Set Cross-Chain Deviation Threshold</b>\n\nPlease enter your deviation threshold percentage (e.g. <code>5</code> for 5% drift):`,
            { parse_mode: 'HTML' },
          );
          return;

        case '/toggleCrossChainRebalance':
          user.crossChainRebalanceEnabled = !user.crossChainRebalanceEnabled;
          await user.save();
          await this.bot.sendMessage(
            chatId,
            `🤖 Cross-chain auto-rebalancing is now <b>${user.crossChainRebalanceEnabled ? '✅ Enabled' : '❌ Disabled'}</b>.`,
            { parse_mode: 'HTML' },
          );
          return;

        case '/triggerCrossChainRebalance': {
          await this.bot.sendMessage(
            chatId,
            '🔍 Checking cross-chain USDC drift...',
          );
          const res = await this.agentService.rebalanceCrossChain(
            chatId,
            false,
          );

          if (res.executedBridges.length === 0) {
            await this.bot.sendMessage(
              chatId,
              '✅ Cross-chain USDC ratios are within limits. No bridging needed.',
            );
            return;
          }

          let planDesc = '🔄 <b>Bridges Executed:</b>\n\n';
          for (const b of res.executedBridges) {
            planDesc += `• Bridged ${b.amount} USDC from <b>${b.from}</b> ➔ <b>${b.to}</b> (${b.reason}) [Status: ${b.status}]\n`;
          }
          await this.bot.sendMessage(chatId, planDesc, { parse_mode: 'HTML' });
          return;
        }

        case '/dryRunCrossChain': {
          const res = await this.agentService.rebalanceCrossChain(chatId, true);
          if (res.executedBridges.length === 0) {
            await this.bot.sendMessage(
              chatId,
              '🔬 [Simulation] Cross-chain ratios are balanced. No actions planned.',
            );
            return;
          }

          let planDesc = '🔬 <b>Rebalance Simulation Plan (Dry Run):</b>\n\n';
          for (const b of res.executedBridges) {
            planDesc += `• Bridge <b>${b.amount} USDC</b> from <b>${b.from}</b> ➔ <b>${b.to}</b> (${b.reason})\n`;
          }
          planDesc += `\n<i>No CCTP bridge transfers were executed.</i>`;
          await this.bot.sendMessage(chatId, planDesc, { parse_mode: 'HTML' });
          return;
        }

        case '/closeDelete':
          await this.sessionModel.deleteMany({ chatId });
          return await this.bot.deleteMessage(chatId, query.message.message_id);

        case '/close':
          return await this.bot.deleteMessage(chatId, query.message.message_id);

        default:
          await this.bot.sendMessage(
            chatId,
            'Processing command failed, please try again.',
          );
          return;
      }
    } catch (error) {
      this.logger.error('Error in handleButtonCommands:', error);
    }
  };

  handleUserTextInputs = async (msg: any, session: SessionDocument) => {
    const chatId = msg.chat.id;
    const text = msg.text.trim();

    try {
      if (session.allocationSetting) {
        const parts = text.split(/\s+/).map(Number);
        if (
          parts.length === 3 &&
          parts.every((n) => !isNaN(n) && n >= 0 && n <= 100)
        ) {
          const [usdc, eurc, btc] = parts;
          if (usdc + eurc + btc === 100) {
            await this.userModel.updateOne(
              { chatId },
              {
                allocationUsdc: usdc,
                allocationEurc: eurc,
                allocationCirbtc: btc,
              },
            );
            await this.sessionModel.deleteOne({ chatId });
            await this.bot.sendMessage(
              chatId,
              `✅ <b>Target allocations saved successfully:</b>\n• USDC: <code>${usdc}%</code>\n• EURC: <code>${eurc}%</code>\n• cirBTC: <code>${btc}%</code>`,
              { parse_mode: 'HTML' },
            );
            return;
          }
        }
        await this.bot.sendMessage(
          chatId,
          `⚠️ Invalid format or sum is not 100%. Please enter exactly three numbers that sum to 100 (e.g. <code>50 30 20</code>):`,
          { parse_mode: 'HTML' },
        );
      } else if (session.thresholdSetting) {
        const threshold = parseFloat(text);
        if (!isNaN(threshold) && threshold >= 0.1 && threshold <= 50) {
          await this.userModel.updateOne(
            { chatId },
            { rebalanceThreshold: threshold },
          );
          await this.sessionModel.deleteOne({ chatId });
          await this.bot.sendMessage(
            chatId,
            `✅ <b>Rebalancing deviation threshold saved:</b> <code>${threshold}%</code>`,
            { parse_mode: 'HTML' },
          );
          return;
        }
        await this.bot.sendMessage(
          chatId,
          `⚠️ Invalid input. Please enter a percentage between 0.1 and 50 (e.g. <code>5</code>):`,
          { parse_mode: 'HTML' },
        );
      } else if (session.crossChainAllocationSetting) {
        const parts = text.split(/\s+/).map(Number);
        if (
          parts.length === 3 &&
          parts.every((n) => !isNaN(n) && n >= 0 && n <= 100)
        ) {
          const [base, solana, arc] = parts;
          if (base + solana + arc === 100) {
            await this.userModel.updateOne(
              { chatId },
              {
                allocationBase: base,
                allocationSolana: solana,
                allocationArc: arc,
              },
            );
            await this.sessionModel.deleteOne({ chatId });
            await this.bot.sendMessage(
              chatId,
              `✅ <b>Cross-chain target allocations saved successfully:</b>\n• Base Sepolia: <code>${base}%</code>\n• Solana Devnet: <code>${solana}%</code>\n• ARC Testnet: <code>${arc}%</code>`,
              { parse_mode: 'HTML' },
            );
            return;
          }
        }
        await this.bot.sendMessage(
          chatId,
          `⚠️ Invalid format or sum is not 100%. Please enter exactly three numbers that sum to 100 (e.g. <code>33 33 34</code>):`,
          { parse_mode: 'HTML' },
        );
      } else if (session.crossChainThresholdSetting) {
        const threshold = parseFloat(text);
        if (!isNaN(threshold) && threshold >= 0.1 && threshold <= 50) {
          await this.userModel.updateOne(
            { chatId },
            { crossChainThreshold: threshold },
          );
          await this.sessionModel.deleteOne({ chatId });
          await this.bot.sendMessage(
            chatId,
            `✅ <b>Cross-chain deviation threshold saved:</b> <code>${threshold}%</code>`,
            { parse_mode: 'HTML' },
          );
          return;
        }
        await this.bot.sendMessage(
          chatId,
          `⚠️ Invalid input. Please enter a percentage between 0.1 and 50 (e.g. <code>5</code>):`,
          { parse_mode: 'HTML' },
        );
      }
    } catch (error) {
      this.logger.error('Error handling user text input:', error);
      await this.bot.sendMessage(
        chatId,
        '⚠️ Error saving settings. Please try again.',
      );
    }
  };

  sendAllFeature = async (user: UserDocument) => {
    try {
      const sync = await this.vaultService.syncBalances(user.chatId);
      const allFeatures = await allFeaturesMarkup(user, sync.totalValueUSD);
      if (allFeatures) {
        const replyMarkup = {
          inline_keyboard: allFeatures.keyboard,
        };
        await this.bot.sendMessage(user.chatId, allFeatures.message, {
          parse_mode: 'HTML',
          reply_markup: replyMarkup,
        });
      }
    } catch (error) {
      this.logger.error('Error in sendAllFeature:', error);
    }
  };
}
