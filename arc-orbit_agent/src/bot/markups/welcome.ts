export const welcomeMessageMarkup = async (userName: string) => {
  console.log(userName);
  return {
    message: `Hi @${userName} 👋, Welcome to <b>arcOrbit</b> agent\n\nI manage your <b>USDC</b> portfolio across two modes: 👇\n - Portfolio — auto-rebalance, yield via USYC, regime-aware\n - Arbitrage — scan for dislocations, execute, return to base\n to get started `,

    keyboard: [
      [
        {
          text: 'Lets get started 🚀',
          callback_data: JSON.stringify({
            command: '/menu',
            language: 'english',
          }),
        },
      ],
    ],
  };
};
