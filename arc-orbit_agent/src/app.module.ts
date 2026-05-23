import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WalletModule } from './wallet/wallet.module';
import { DatabaseModule } from './database/database.module';
import { BotModule } from './bot/bot.module';
import { UserModule } from './user/user.module';
import { AgentModule } from './agent/agent.module';
import { RelayModule } from './relay/relay.module';
import { PriceModule } from './price/price.module';
import { VaultModule } from './vault/vault.module';
import { SwapModule } from './swap/swap.module';
import { RebalanceModule } from './rebalance/rebalance.module';

@Module({
  imports: [
    WalletModule,
    DatabaseModule,
    BotModule,
    UserModule,
    AgentModule,
    RelayModule,
    PriceModule,
    VaultModule,
    SwapModule,
    RebalanceModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
