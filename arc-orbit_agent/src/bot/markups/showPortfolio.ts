export const showPortfolioMarkup = async (data: {
  chatId: number;
  totalValueUSD: string;
  rebalanceEnabled: boolean;
  rebalanceThreshold: number;
  assets: Array<{
    token: string;
    balance: string;
    valueUSD: string;
    priceUSD: number;
    actualPct: number;
    targetPct: number;
  }>;
}) => {
  let assetLines = '';
  for (const asset of data.assets) {
    const diff = asset.actualPct - asset.targetPct;
    const diffSign = diff >= 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`;
    assetLines +=
      `<b>➤ ${asset.token}</b>\n` +
      ` • Balance: <code>${parseFloat(asset.balance)
        .toFixed(6)
        .replace(/\.?0+$/, '')}</code>\n` +
      ` • Price: <code>$${asset.priceUSD.toLocaleString()}</code>\n` +
      ` • Value: <code>$${parseFloat(asset.valueUSD).toLocaleString()}</code>\n` +
      ` • Allocation: <code>${asset.actualPct.toFixed(1)}%</code> (Target: <code>${asset.targetPct}%</code>, Drift: <code>${diffSign}</code>)\n\n`;
  }

  const message =
    `📊 <b>ARC Treasury Portfolio Overview</b>\n\n` +
    `Total Valuation: <b>$${parseFloat(data.totalValueUSD).toLocaleString()}</b>\n\n` +
    `${assetLines}` +
    `🔄 <b>Rebalancer Settings:</b>\n` +
    ` • Auto-Rebalancing: <b>${data.rebalanceEnabled ? '✅ Enabled' : '❌ Disabled'}</b>\n` +
    ` • Drift Threshold: <b>${data.rebalanceThreshold}%</b>`;

  return {
    message,
    keyboard: [
      [
        {
          text: '🔄 Rebalance Now',
          callback_data: JSON.stringify({
            command: '/rebalanceNow',
            language: 'english',
          }),
        },
        {
          text: '🧪 Dry Run (Simulate)',
          callback_data: JSON.stringify({
            command: '/dryRunRebalance',
            language: 'english',
          }),
        },
      ],
      [
        {
          text: 'Close ❌',
          callback_data: JSON.stringify({
            command: '/close',
            language: 'english',
          }),
        },
      ],
    ],
  };
};
