export const crossChainMarkup = async (data: {
  totalUSDC: string;
  crossChainRebalanceEnabled: boolean;
  crossChainThreshold: number;
  chains: Array<{
    name: string;
    balance: string;
    actualPct: number;
    targetPct: number;
    drift: number;
  }>;
}) => {
  let chainLines = '';
  for (const chain of data.chains) {
    const diffSign = chain.drift >= 0 ? `+${chain.drift.toFixed(1)}%` : `${chain.drift.toFixed(1)}%`;
    chainLines +=
      `<b>➤ ${chain.name}</b>\n` +
      ` • Balance: <code>${parseFloat(chain.balance).toFixed(6).replace(/\.?0+$/, '')} USDC</code>\n` +
      ` • Allocation: <code>${chain.actualPct.toFixed(1)}%</code> (Target: <code>${chain.targetPct}%</code>, Drift: <code>${diffSign}</code>)\n\n`;
  }

  const message =
    `🌉 <b>Cross-Chain USDC Ingress & Rebalance Hub</b>\n\n` +
    `Total Unified USDC: <b>$${parseFloat(data.totalUSDC).toLocaleString()}</b>\n\n` +
    `${chainLines}` +
    `🤖 <b>Rebalancer Config:</b>\n` +
    ` • Auto-Rebalancing: <b>${data.crossChainRebalanceEnabled ? '✅ Enabled' : '❌ Disabled'}</b>\n` +
    ` • Deviation Threshold: <b>${data.crossChainThreshold}%</b>`;

  return {
    message,
    keyboard: [
      [
        {
          text: '🔄 Rebalance Now',
          callback_data: JSON.stringify({
            command: '/triggerCrossChainRebalance',
            language: 'english',
          }),
        },
        {
          text: '🧪 Dry Run',
          callback_data: JSON.stringify({
            command: '/dryRunCrossChain',
            language: 'english',
          }),
        },
      ],
      [
        {
          text: '🎯 Set Target Allocations',
          callback_data: JSON.stringify({
            command: '/setCrossChainAllocation',
            language: 'english',
          }),
        },
        {
          text: '🔼 Set Drift Threshold',
          callback_data: JSON.stringify({
            command: '/setCrossChainThreshold',
            language: 'english',
          }),
        },
      ],
      [
        {
          text: data.crossChainRebalanceEnabled
            ? '🤖 Disable Auto-Rebalance'
            : '🤖 Enable Auto-Rebalance',
          callback_data: JSON.stringify({
            command: '/toggleCrossChainRebalance',
            language: 'english',
          }),
        },
      ],
      [
        {
          text: '⬅️ Back to Menu',
          callback_data: JSON.stringify({
            command: '/menu',
            language: 'english',
          }),
        },
      ],
    ],
  };
};
