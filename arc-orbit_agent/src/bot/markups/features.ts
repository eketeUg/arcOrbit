import { UserDocument } from 'src/database/schemas/user.schema';

export const allFeaturesMarkup = async (
  user: UserDocument,
  totalValuationUSD: string,
) => {
  return {
    message:
      `🪐 <b>arcOrbit Central Hub</b>\n\n` +
      `<b>💳 Addresses:</b>\n` +
      ` • EVM (ARC/Base): <code>${user.evmWallet.address}</code>\n` +
      ` • SVM (Solana): <code>${user.svmWallet.address}</code>\n\n` +
      `💰 <b>ARC Vault Valuation:</b> $${parseFloat(totalValuationUSD).toLocaleString()}\n` +
      `🎯 <b>Target Allocation:</b> USDC ${user.allocationUsdc}% | EURC ${user.allocationEurc}% | cirBTC ${user.allocationCirbtc}%\n` +
      `🔼 <b>Drift Threshold:</b> ${user.rebalanceThreshold}%\n` +
      `🤖 <b>Auto-Rebalancing:</b> ${user.rebalanceEnabled ? '✅ Enabled' : '❌ Disabled'}`,
    keyboard: [
      [
        {
          text: '📊 Portfolio Overview',
          callback_data: JSON.stringify({
            command: '/portfolioOverview',
            language: 'english',
          }),
        },
        {
          text: '🌉 Cross-Chain Hub',
          callback_data: JSON.stringify({
            command: '/crossChainOverview',
            language: 'english',
          }),
        },
      ],
      [
        {
          text: '💳 Balance details',
          callback_data: JSON.stringify({
            command: '/walletFeatures',
            language: 'english',
          }),
        },
      ],

      [
        {
          text: '🎯 Set Target Allocation',
          callback_data: JSON.stringify({
            command: '/setTargetAllocation',
            language: 'english',
          }),
        },
        {
          text: '🔼 Set Drift Threshold',
          callback_data: JSON.stringify({
            command: '/setThreshold',
            language: 'english',
          }),
        },
      ],
      [
        {
          text: user.rebalanceEnabled
            ? '🔄 Disable Auto-Rebalancing'
            : '🔄 Enable Auto-Rebalancing',
          callback_data: JSON.stringify({
            command: '/enableRebalance',
            language: 'english',
          }),
        },
      ],
      [
        {
          text: '❓ Help & Support',
          url: `https://t.me/+uvluoEnCbiU5YTBk`,
        },
      ],
    ],
  };
};
