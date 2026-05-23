export const welcomeMessageMarkup = async (userName: string) => {
  const message =
    `✨ <b>Welcome to arcOrbit Agent, @${userName}!</b> 👋\n\n` +
    `I am your intelligent cross-chain treasury hub and settlement manager, running on the <b>ARC Testnet</b>.\n\n` +
    `🛸 <b>What I do for you:</b>\n` +
    `• <b>Programmable ARC Vault</b>: I manage your multi-asset treasury of <code>USDC</code>, <code>EURC</code>, and <code>cirBTC</code> on ARC, rebalancing your assets automatically to defend target splits.\n` +
    `• <b>Cross-Chain Ingress (CCTP)</b>: I monitor your USDC balances on Base Sepolia, Solana Devnet, and ARC, automatically routing deposits and rebalancing capital using CCTP.\n` +
    `• <b>Conversational Execution</b>: You can chat with me directly! Try typing: <code>Swap 10 USDC to EURC</code>.\n\n` +
    `Ready to set up your target allocations and watch your automated treasury in action? 🚀`;

  return {
    message,
    keyboard: [
      [
        {
          text: 'Enter Central Hub 🪐',
          callback_data: JSON.stringify({
            command: '/menu',
            language: 'english',
          }),
        },
      ],
      [
        {
          text: '📊 View Portfolio',
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
    ],
  };
};
