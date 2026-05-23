import { Injectable } from '@nestjs/common';
import { CircleDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';

import { client } from './config';

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

  async getWalletBalances(walletId: string): Promise<any[]> {
    try {
      const response = await this.client.getWalletTokenBalance({
        id: walletId,
      });
      return response.data?.tokenBalances ?? [];
    } catch (error) {
      console.error('Error fetching wallet balances:', error);
      return [];
    }
  }

  async getUSDCBalanceOnChain(
    address: string,
    blockchain: 'ARC-TESTNET' | 'BASE-SEPOLIA' | 'SOL-DEVNET',
  ): Promise<string> {
    try {
      const response = await this.client.getWalletsWithBalances({
        blockchain: blockchain as any,
        address,
      });
      const wallet = response.data?.wallets?.[0];
      const usdc = (wallet as any)?.tokenBalances?.find(
        (b: any) => b.token?.symbol === 'USDC',
      );
      return usdc?.amount ?? '0';
    } catch (error) {
      console.error(`Error fetching USDC balance on ${blockchain}:`, error);
      return '0';
    }
  }
}
