export const walletFeaturesMarkup = async () => {
  return {
    message: `Please Select any action below 👇`,
    keyboard: [
      [
        {
          text: 'Fund wallet 💵',
          callback_data: JSON.stringify({
            command: '/fundWallet',
            language: 'english',
          }),
        },
      ],
      [
        {
          text: 'Export wallet',
          callback_data: JSON.stringify({
            command: '/exportWallet',
            language: 'english',
          }),
        },
        {
          text: 'check Balance',
          callback_data: JSON.stringify({
            command: '/checkBalance',
            language: 'english',
          }),
        },
      ],
      [
        {
          text: 'close ❌',
          callback_data: JSON.stringify({
            command: '/close',
            language: 'english',
          }),
        },
      ],
    ],
  };
};
