import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RebalanceService } from './rebalance.service';
import { VaultModule } from '../vault/vault.module';
import { SwapModule } from '../swap/swap.module';
import { PriceModule } from '../price/price.module';
import { User, UserSchema } from '../database/schemas/user.schema';
import {
  RebalanceJob,
  RebalanceJobSchema,
} from '../database/schemas/rebalance-job.schema';

@Module({
  imports: [
    VaultModule,
    SwapModule,
    PriceModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: RebalanceJob.name, schema: RebalanceJobSchema },
    ]),
  ],
  providers: [RebalanceService],
  exports: [RebalanceService],
})
export class RebalanceModule {}
