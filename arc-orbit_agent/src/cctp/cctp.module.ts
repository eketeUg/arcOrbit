import { Module } from '@nestjs/common';
import { CctpService } from './cctp.service';

@Module({
  providers: [CctpService]
})
export class CctpModule {}
