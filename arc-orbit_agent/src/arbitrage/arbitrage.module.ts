import { Module } from '@nestjs/common';
import { ArbitrageService } from './arbitrage.service';

@Module({
  providers: [ArbitrageService]
})
export class ArbitrageModule {}
