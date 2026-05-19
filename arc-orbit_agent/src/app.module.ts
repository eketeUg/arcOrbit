import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { WalletModule } from './wallet/wallet.module';
import { DatabaseModule } from './database/database.module';
import { BotModule } from './bot/bot.module';
import { UserModule } from './user/user.module';
import { AgentModule } from './agent/agent.module';
import { ChainsModule } from './chains/chains.module';
import { CctpModule } from './cctp/cctp.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { ArbitrageModule } from './arbitrage/arbitrage.module';

@Module({
  imports: [
    WalletModule,
    DatabaseModule,
    BotModule,
    UserModule,
    AgentModule,
    ChainsModule,
    CctpModule,
    PortfolioModule,
    ArbitrageModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
