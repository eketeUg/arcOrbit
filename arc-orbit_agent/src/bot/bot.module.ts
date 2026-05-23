import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from 'src/database/schemas/user.schema';
import { Session, SessionSchema } from 'src/database/schemas/session.schema';
import { WalletModule } from 'src/wallet/wallet.module';
import { DatabaseModule } from 'src/database/database.module';
import { UserModule } from 'src/user/user.module';
import { RelayModule } from 'src/relay/relay.module';
import { PriceModule } from 'src/price/price.module';
import { VaultModule } from 'src/vault/vault.module';
import { SwapModule } from 'src/swap/swap.module';
import { RebalanceModule } from 'src/rebalance/rebalance.module';
import { AgentModule } from 'src/agent/agent.module';

@Module({
  imports: [
    DatabaseModule,
    WalletModule,
    UserModule,
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Session.name, schema: SessionSchema },
    ]),
    RelayModule,
    PriceModule,
    VaultModule,
    SwapModule,
    RebalanceModule,
    AgentModule,
  ],
  providers: [BotService],
})
export class BotModule {}
