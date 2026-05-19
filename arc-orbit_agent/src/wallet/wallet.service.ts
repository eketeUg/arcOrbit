import { Injectable } from '@nestjs/common';
import {
  CircleDeveloperControlledWalletsClient,
  initiateDeveloperControlledWalletsClient,
} from '@circle-fin/developer-controlled-wallets';
import {
  createUnifiedBalanceKitContext,
  deposit,
  spend,
} from '@circle-fin/unified-balance-kit';
import {
  chainConfig,
  client,
  findDepositPDAs,
  GATEWAY_WALLET_ADDRESS_EVM,
  GATEWAY_WALLET_ADDRESS_SOLANA,
  gatewayWalletIdl,
  parseBalance,
  RPC_ENDPOINT,
  USDC_ADDRESS_SOLANA,
  waitForTxCompletion,
} from './config';
import { GatewayBalancesResponse } from './interface';
import {
  Wallet,
  AnchorProvider,
  setProvider,
  Program,
} from '@coral-xyz/anchor';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  getAccount,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import BN from 'bn.js';
import Decimal from 'decimal.js';

@Injectable()
export class WalletService {
  private client: CircleDeveloperControlledWalletsClient;

  constructor() {
    this.client = client;
  }

  async createWallet(): Promise<object[]> {
    const walletSetResponse = await this.client.createWalletSet({
      name: 'arcOrbit wallet Set',
    });

    const walletSet = walletSetResponse.data?.walletSet;
    if (!walletSet?.id) {
      throw new Error('Wallet set creation failed: no ID returned');
    }

    const walletResponse = await this.client.createWallets({
      walletSetId: walletSet.id,
      blockchains: ['ARC-TESTNET', 'SOL-DEVNET'], // Can be any supported blockchain
      count: 1,
      accountType: 'EOA', // Can be EOA or SCA
    });

    console.log('Wallet set response:', walletSetResponse.data);
    console.log('Wallet response:', walletResponse.data);
    const wallet = walletResponse.data?.wallets;
    if (!wallet || wallet.length === 0) {
      throw new Error('Wallet creation failed: no ID returned');
    }
    return wallet;
  }

  async depositToUnifiedWallet(
    amount: string,
    sourceChain: string,
    depositorAddress: string,
  ) {
    try {
      const isSolana = sourceChain === 'solana';
      if (!isSolana) {
        const SOURCE_CHAIN = sourceChain;
        const sourceConfig = chainConfig[SOURCE_CHAIN];

        console.log(`Using account: ${depositorAddress}`);
        console.log(`Depositing on: ${sourceConfig.chainName}`);

        // [1] Approve the Gateway Wallet to spend USDC on the source chain.
        console.log(`Approving ${amount} USDC on ${sourceConfig.chainName}...`);

        const approveTx = await client.createContractExecutionTransaction({
          walletAddress: depositorAddress,
          blockchain: sourceConfig.walletChain,
          contractAddress: sourceConfig.usdc,
          abiFunctionSignature: 'approve(address,uint256)',
          abiParameters: [
            GATEWAY_WALLET_ADDRESS_EVM,
            parseBalance(amount).toString(),
          ],
          fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
        });

        const approveTxId = approveTx.data?.id;
        if (!approveTxId)
          throw new Error('Failed to create approve transaction');
        await waitForTxCompletion(client, approveTxId, 'USDC approve');

        // [2] Call the Gateway deposit function on the source chain.
        console.log(`Depositing ${amount} USDC to Gateway Wallet`);

        const depositTx = await client.createContractExecutionTransaction({
          walletAddress: depositorAddress,
          blockchain: sourceConfig.walletChain,
          contractAddress: GATEWAY_WALLET_ADDRESS_EVM,
          abiFunctionSignature: 'deposit(address,uint256)',
          abiParameters: [sourceConfig.usdc, parseBalance(amount).toString()],
          fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
        });

        const depositTxId = depositTx.data?.id;
        if (!depositTxId)
          throw new Error('Failed to create deposit transaction');
        await waitForTxCompletion(client, depositTxId, 'Gateway deposit');

        console.log(
          '\n==| Block confirmation may take up to 19 minutes for some chains |==',
        );
      } else {
        const DEPOSIT_AMOUNT = new BN(
          new Decimal(amount)

            .mul(1_000_000)

            .toFixed(0),
        );

        // Set up the Solana connection and core account addresses.
        const connection = new Connection(RPC_ENDPOINT, 'confirmed');
        const usdcMint = new PublicKey(USDC_ADDRESS_SOLANA);
        const programId = new PublicKey(GATEWAY_WALLET_ADDRESS_SOLANA);
        const owner = new PublicKey(depositorAddress);

        console.log(`Using account: ${owner.toBase58()}`);
        console.log(`\n=== Processing Solana Devnet ===`);
        // [1] Check the depositor's current USDC balance.
        const userTokenAccount = getAssociatedTokenAddressSync(usdcMint, owner);
        const tokenAccountInfo = await getAccount(connection, userTokenAccount);
        const currentBalance = Number(tokenAccountInfo.amount) / 1_000_000;
        console.log(`Current balance: ${currentBalance} USDC`);

        if (tokenAccountInfo.amount < BigInt(DEPOSIT_AMOUNT.toString())) {
          throw new Error(
            'Insufficient USDC balance. Please top up at https://faucet.circle.com',
          );
        }

        // [2] Set up the Anchor client and derive the Gateway deposit PDAs.
        const dummyWallet = new Wallet(Keypair.generate());
        const provider = new AnchorProvider(
          connection,
          dummyWallet,
          AnchorProvider.defaultOptions(),
        );
        setProvider(provider);
        const program = new Program(gatewayWalletIdl, provider);
        const pdas = findDepositPDAs(programId, usdcMint, owner);
      }
    } catch (error) {
      console.error('Deposit failed:', error);
    }
  }

  async getUnifiedBalance(walletAddress: string): Promise<string> {
    try {
      const EVM_DOMAINS = {
        ethereum: 0,
        avalanche: 1,
        optimism: 2,
        arbitrum: 3,
        base: 6,
        polygon: 7,
        unichain: 10,
        arc: 26,
      };

      const SOLANA_DOMAINS = {
        solana: 5,
      };

      const DOMAINS = { ...EVM_DOMAINS, ...SOLANA_DOMAINS };

      const isEvmAddress = walletAddress.startsWith('0x');
      const activeDomains = isEvmAddress ? EVM_DOMAINS : SOLANA_DOMAINS;
      const domainIds = Object.values(activeDomains);

      const body = {
        token: 'USDC',
        sources: domainIds.map((domain) => ({
          domain,
          depositor: walletAddress,
        })),
      };

      const res = await fetch(
        'https://gateway-api-testnet.circle.com/v1/balances',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );

      const result = (await res.json()) as GatewayBalancesResponse;

      let total = 0;
      for (const balance of result.balances) {
        const chain =
          Object.keys(DOMAINS).find(
            (k) => DOMAINS[k as keyof typeof DOMAINS] === balance.domain,
          ) || `Domain ${balance.domain}`;
        const amount = parseFloat(balance.balance);
        console.log(`${chain}: ${amount.toFixed(6)} USDC`);
        total += amount;
      }

      console.log(`\nTotal: ${total.toFixed(6)} USDC`);
      const balance = total.toFixed(6);
      return balance;
    } catch (error) {
      console.error('error fetching unified balance', error);
    }
  }
}
