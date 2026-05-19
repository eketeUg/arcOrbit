import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import {
  u32be,
  nu64be,
  struct,
  seq,
  blob,
  offset,
  Layout,
} from '@solana/buffer-layout';
import bs58 from 'bs58';
import * as dotenv from 'dotenv';
dotenv.config();

export const RPC_ENDPOINT = 'https://api.devnet.solana.com';
export const SOLANA_DOMAIN = 5;
export const SOLANA_ZERO_ADDRESS = '11111111111111111111111111111111';

type WalletChain = 'ARC-TESTNET' | 'BASE-SEPOLIA';

type EvmChainConfig = {
  chainName: string;
  usdc: string;
  domain: number;
  walletChain: WalletChain;
};

export const chainConfig = {
  arc: {
    chainName: 'Arc Testnet',
    usdc: '0x3600000000000000000000000000000000000000',
    domain: 26,
    walletChain: 'ARC-TESTNET',
  },
  base: {
    chainName: 'Base Sepolia',
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    domain: 6,
    walletChain: 'BASE-SEPOLIA',
  },
} as const satisfies Record<string, EvmChainConfig>;

export type ChainKey = keyof typeof chainConfig;

export const GATEWAY_API_BASE = 'https://gateway-api-testnet.circle.com';
export const GATEWAY_WALLET_ADDRESS_EVM =
  '0x0077777d7EBA4688BDeF3E311b846F25870A19B9';
export const GATEWAY_MINTER_ADDRESS_EVM =
  '0x0022222ABE238Cc2C7Bb1f21003F0a260052475B';
export const GATEWAY_WALLET_ADDRESS_SOLANA =
  'GATEwdfmYNELfp5wDmmR6noSr2vHnAfBPMm2PvCzX5vu';
export const GATEWAY_MINTER_ADDRESS_SOLANA =
  'GATEmKK2ECL1brEngQZWCgMWPbvrEYqsV6u29dAaHavr';

export const USDC_ADDRESS_SOLANA =
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

export const API_KEY = process.env.CIRCLE_API_KEY!;
export const ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET!;
export const DEPOSITOR_ADDRESS = process.env.DEPOSITOR_ADDRESS!;

if (!API_KEY || !ENTITY_SECRET) {
  console.error(
    'Missing required env vars: CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET',
  );
  process.exit(1);
}

/* Circle Wallets Client */
export const client = initiateDeveloperControlledWalletsClient({
  apiKey: API_KEY,
  entitySecret: ENTITY_SECRET,
});

export async function waitForTxCompletion(
  client: ReturnType<typeof initiateDeveloperControlledWalletsClient>,
  txId: string,
  label: string,
) {
  const terminalStates = new Set([
    'COMPLETE',
    'CONFIRMED',
    'FAILED',
    'DENIED',
    'CANCELLED',
  ]);

  process.stdout.write(`Waiting for ${label} (txId=${txId})\n`);

  while (true) {
    const { data } = await client.getTransaction({ id: txId });
    const state = data?.transaction?.state;

    process.stdout.write('.');

    if (state && terminalStates.has(state)) {
      process.stdout.write('\n');
      console.log(`${label} final state: ${state}`);

      if (state !== 'COMPLETE' && state !== 'CONFIRMED') {
        throw new Error(
          `${label} did not complete successfully (state=${state})`,
        );
      }
      return data.transaction;
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

export function parseBalance(
  value: string | number | null | undefined,
): bigint {
  const str = String(value ?? '0');
  const [whole, decimal = ''] = str.split('.');
  const decimal6 = (decimal + '000000').slice(0, 6);
  return BigInt((whole || '0') + decimal6);
}

export function addressToBytes32(address: string) {
  return ('0x' +
    address
      .toLowerCase()
      .replace(/^0x/, '')
      .padStart(64, '0')) as `0x${string}`;
}

export function stringifyTypedData<T>(obj: T) {
  return JSON.stringify(obj, (_key, value) =>
    typeof value === 'bigint' ? value.toString() : value,
  );
}

export class PublicKeyLayout extends Layout<PublicKey> {
  constructor(property: string) {
    super(32, property);
  }
  decode(b: Buffer, offset = 0): PublicKey {
    return new PublicKey(b.subarray(offset, offset + 32));
  }
  encode(src: PublicKey, b: Buffer, offset = 0): number {
    const pubkeyBuffer = src.toBuffer();
    pubkeyBuffer.copy(b, offset);
    return 32;
  }
}

export const publicKey = (property: string) => new PublicKeyLayout(property);

const MintAttestationElementLayout = struct([
  publicKey('destinationToken'),
  publicKey('destinationRecipient'),
  nu64be('value'),
  blob(32, 'transferSpecHash'),
  u32be('hookDataLength'),
  blob(offset(u32be(), -4), 'hookData'),
] as any);

const MintAttestationSetLayout = struct([
  u32be('magic'),
  u32be('version'),
  u32be('destinationDomain'),
  publicKey('destinationContract'),
  publicKey('destinationCaller'),
  nu64be('maxBlockHeight'),
  u32be('numAttestations'),
  seq(MintAttestationElementLayout, offset(u32be(), -4), 'attestations'),
] as any);

// Sample-local IDL subset for this example.
export const gatewayWalletIdl = {
  address: GATEWAY_WALLET_ADDRESS_SOLANA,
  metadata: {
    name: 'gatewayWallet',
    version: '0.1.0',
    spec: '0.1.0',
  },
  instructions: [
    {
      name: 'deposit',
      discriminator: [22, 0],
      accounts: [
        { name: 'payer', writable: true, signer: true },
        { name: 'owner', signer: true },
        { name: 'gatewayWallet' },
        { name: 'ownerTokenAccount', writable: true },
        { name: 'custodyTokenAccount', writable: true },
        { name: 'deposit', writable: true },
        { name: 'depositorDenylist' },
        { name: 'tokenProgram' },
        { name: 'systemProgram' },
        { name: 'eventAuthority' },
        { name: 'program' },
      ],
      args: [{ name: 'amount', type: 'u64' }],
    },
  ],
};

// Sample-local IDL subset for this example.
export const gatewayMinterIdl = {
  address: GATEWAY_MINTER_ADDRESS_SOLANA,
  metadata: { name: 'gatewayMinter', version: '0.1.0', spec: '0.1.0' },
  instructions: [
    {
      name: 'gatewayMint',
      discriminator: [12, 0],
      accounts: [
        { name: 'payer', writable: true, signer: true },
        { name: 'destinationCaller', signer: true },
        { name: 'gatewayMinter' },
        { name: 'systemProgram' },
        { name: 'tokenProgram' },
        { name: 'eventAuthority' },
        { name: 'program' },
      ],
      args: [
        {
          name: 'params',
          type: { defined: { name: 'gatewayMintParams' } },
        },
      ],
    },
  ],
  types: [
    {
      name: 'gatewayMintParams',
      type: {
        kind: 'struct',
        fields: [
          { name: 'attestation', type: 'bytes' },
          { name: 'signature', type: 'bytes' },
        ],
      },
    },
  ],
};

export function findDepositPDAs(
  programId: PublicKey,
  usdcMint: PublicKey,
  owner: PublicKey,
) {
  return {
    wallet: PublicKey.findProgramAddressSync(
      [Buffer.from('gateway_wallet')],
      programId,
    )[0],
    custody: PublicKey.findProgramAddressSync(
      [Buffer.from('gateway_wallet_custody'), usdcMint.toBuffer()],
      programId,
    )[0],
    deposit: PublicKey.findProgramAddressSync(
      [Buffer.from('gateway_deposit'), usdcMint.toBuffer(), owner.toBuffer()],
      programId,
    )[0],
    denylist: PublicKey.findProgramAddressSync(
      [Buffer.from('denylist'), owner.toBuffer()],
      programId,
    )[0],
  };
}

export function findCustodyPda(
  mint: PublicKey,
  minterProgramId: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('gateway_minter_custody'), mint.toBuffer()],
    minterProgramId,
  )[0];
}

export function findTransferSpecHashPda(
  transferSpecHash: Uint8Array | Buffer,
  minterProgramId: PublicKey,
): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('used_transfer_spec_hash'), Buffer.from(transferSpecHash)],
    minterProgramId,
  )[0];
}

export function decodeAttestationSet(attestation: string) {
  const buffer = Buffer.from(attestation.slice(2), 'hex');
  return MintAttestationSetLayout.decode(buffer) as {
    attestations: Array<{
      destinationToken: PublicKey;
      destinationRecipient: PublicKey;
      transferSpecHash: Uint8Array;
    }>;
  };
}

export function solanaAddressToBytes32(address: string): string {
  const decoded = Buffer.from(bs58.decode(address));
  return `0x${decoded.toString('hex')}`;
}

export function hexToPublicKey(hex: string): PublicKey {
  return new PublicKey(Buffer.from(hex.slice(2), 'hex'));
}

export async function signAndBroadcast(
  circleClient: ReturnType<typeof initiateDeveloperControlledWalletsClient>,
  connection: Connection,
  transaction: Transaction,
  walletAddress: string,
  label: string,
): Promise<string> {
  const serialized = transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });

  console.log(`Signing ${label} via Circle Wallets...`);
  const signResult = await circleClient.signTransaction({
    walletAddress,
    blockchain: 'SOL-DEVNET',
    rawTransaction: serialized.toString('base64'),
  });

  const signedTxBase64 = signResult.data?.signedTransaction;
  if (!signedTxBase64) throw new Error(`Failed to sign ${label}`);

  console.log(`Broadcasting ${label}...`);
  const signedTxBytes = Buffer.from(signedTxBase64, 'base64');
  return connection.sendRawTransaction(signedTxBytes);
}
