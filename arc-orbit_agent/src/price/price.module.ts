import { Module } from '@nestjs/common';
import { PriceService } from './price.service';
import { RelayModule } from '../relay/relay.module';

@Module({
  imports: [RelayModule],
  providers: [PriceService],
  exports: [PriceService],
})
export class PriceModule {}
