import { Injectable } from '@nestjs/common';
import {
  CircleDeveloperControlledWalletsClient,
  initiateDeveloperControlledWalletsClient,
} from '@circle-fin/developer-controlled-wallets';

import * as dotenv from 'dotenv';

dotenv.config();

@Injectable()
export class WalletService {
  private client: CircleDeveloperControlledWalletsClient;

  constructor() {
    this.client = initiateDeveloperControlledWalletsClient({
      apiKey: process.env.CIRCLE_API_KEY!,
      entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
    });
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

  async getWalletBalance(walletId: string): Promise<string> {
    const balanceResponse = await this.client.getWalletBalance(walletId);
    const balance = balanceResponse.data?.balance;
    if (!balance) {
      throw new Error('Failed to retrieve wallet balance');
    }
    return balance;
  }
}
