import { UserDocument } from 'src/database/schemas/user.schema';

export const allFeaturesMarkup = async (
  user: UserDocument,
  balance: string,
) => {
  return {
    message: `<b> Wallets:</b> \n <code>${user.evmWallet.address}</code> (bASE)\n <code>${user.svmWallet.address}</code> (solana) \n\n Unified Balance: ${balance}`,
    keyboard: [
      [{ text: '🤖 Mode' }],
      [
        {
          text: '🔃 Rebalancer',
          callback_data: JSON.stringify({
            command: '/rebalanceMode',
            language: 'english',
          }),
        },
        {
          text: 'Arbitrage ',
          callback_data: JSON.stringify({
            command: '/portfolioOverview',
            language: 'english',
          }),
        },
      ],
      [
        {
          text: '💳 Wallet',
          callback_data: JSON.stringify({
            command: '/walletFeatures',
            language: 'english',
          }),
        },
        {
          text: '📊 Portfolio Overview',
          callback_data: JSON.stringify({
            command: '/portfolioOverview',
            language: 'english',
          }),
        },
      ],
      [
        {
          text: `${user.rebalanceEnabled ? `✅ Auto Rebalancing mode Enabled` : '🔄 Enable Auto Rebalancing agent mode'}`,
          callback_data: JSON.stringify({
            command: '/enableRebalance',
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
          text: '	🔼 Set Threshold',
          callback_data: JSON.stringify({
            command: '/setThreshold',
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
