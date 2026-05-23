import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SwapService } from './swap.service';
import { RelayModule } from '../relay/relay.module';
import { VaultModule } from '../vault/vault.module';
import { User, UserSchema } from '../database/schemas/user.schema';

@Module({
  imports: [
    RelayModule,
    VaultModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  providers: [SwapService],
  exports: [SwapService],
})
export class SwapModule {}
