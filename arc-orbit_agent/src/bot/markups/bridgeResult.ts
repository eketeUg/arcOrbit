interface BridgeStep {
  name: string;
  state: string;
  txHash: string | null;
  explorerUrl: string | null;
}

export const bridgeResultMarkup = async (data: BridgeStep[]) => {
  const rows = data
    .map((step, index) => {
      const shortHash = step.txHash
        ? `${step.txHash.slice(0, 10)}...${step.txHash.slice(-6)}`
        : 'N/A';

      return (
        `${index + 1}. <b>${step.name.toUpperCase()}</b>\n` +
        `├ State: ${step.state}\n` +
        `├ Hash: <code>${shortHash}</code>\n` +
        `${
          step.explorerUrl
            ? `└ <a href="${step.explorerUrl}">View Transaction</a>\n`
            : `└ No Explorer URL\n`
        }`
      );
    })
    .join('\n');

  return {
    message: `<b>🌉 Bridge Transaction Result</b>\n\n` + `${rows}`,

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
