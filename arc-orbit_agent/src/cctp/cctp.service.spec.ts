import { Test, TestingModule } from '@nestjs/testing';
import { CctpService } from './cctp.service';

describe('CctpService', () => {
  let service: CctpService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CctpService],
    }).compile();

    service = module.get<CctpService>(CctpService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
