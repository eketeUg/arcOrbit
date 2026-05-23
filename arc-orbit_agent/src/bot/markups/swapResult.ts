interface swapResult {
  tokenIn: string;
  tokenOut: string;
  chain: string;
  amountIn: string;
  fromAddress: string;
  amountOut: string;
  toAddress: string;
  txHash: string | null;
  explorerUrl: string | null;
  fees: [{ token: string; amount: string; type: string }];
}

export const swapResultMarkup = async (data: swapResult | any) => {
  const shortHash = data.txHash
    ? `${data.txHash.slice(0, 10)}...${data.txHash.slice(-6)}`
    : 'N/A';
  const info =
    `Swap ${data.amountIn} <b>${data.tokenIn}</b> for ${data.amountOut} <b>${data.tokenOut}</b> on <b>${data.chain}</b>\n` +
    `From: <code>${data.fromAddress}</code>\n` +
    `To: <code>${data.toAddress}</code>\n` +
    `Fees: ${data.fees.map((f) => `${f.amount} ${f.token} (${f.type})`).join(', ')}\n` +
    `Hash: <code>${shortHash}</code>\n` +
    (data.explorerUrl
      ? `View on Explorer: <a href="${data.explorerUrl}">Link</a>`
      : 'No Explorer URL');

  return {
    message: `<b>🌉 Swap Transaction Result</b>\n\n` + `${info}`,

    keyboard: [
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
