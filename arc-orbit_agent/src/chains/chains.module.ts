import { Module } from '@nestjs/common';
import { ChainsService } from './chains.service';

@Module({
  providers: [ChainsService]
})
export class ChainsModule {}
