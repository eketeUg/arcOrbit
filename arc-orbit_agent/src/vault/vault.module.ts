import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VaultService } from './vault.service';
import { WalletModule } from '../wallet/wallet.module';
import { PriceModule } from '../price/price.module';
import { User, UserSchema } from '../database/schemas/user.schema';
import {
  VaultSnapshot,
  VaultSnapshotSchema,
} from '../database/schemas/vault-snapshot.schema';
import {
  VaultTransaction,
  VaultTransactionSchema,
} from '../database/schemas/vault-transaction.schema';

@Module({
  imports: [
    WalletModule,
    PriceModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: VaultSnapshot.name, schema: VaultSnapshotSchema },
      { name: VaultTransaction.name, schema: VaultTransactionSchema },
    ]),
  ],
  providers: [VaultService],
  exports: [VaultService],
})
export class VaultModule {}
