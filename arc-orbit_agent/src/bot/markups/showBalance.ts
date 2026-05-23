export const showBalanceMarkup = async (balances: {
  USDC: string;
  EURC: string;
  cirBTC: string;
}) => {
  return {
    message:
      `<b>💳 ARC Treasury Wallet Balances:</b>\n\n` +
      `➤ <b>USDC</b>: <code>${parseFloat(balances.USDC).toFixed(6).replace(/\.?0+$/, '')}</code>\n` +
      `➤ <b>EURC</b>: <code>${parseFloat(balances.EURC).toFixed(6).replace(/\.?0+$/, '')}</code>\n` +
      `➤ <b>cirBTC</b>: <code>${parseFloat(balances.cirBTC).toFixed(8).replace(/\.?0+$/, '')}</code>`,
    keyboard: [
      [
        {
          text: 'Fund Wallet 💵',
          callback_data: JSON.stringify({
            command: '/fundWallet',
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
