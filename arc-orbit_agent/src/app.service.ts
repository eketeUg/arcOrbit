// import { Injectable } from '@nestjs/common';

// @Injectable()
// export class AppService {
//   getHello(): string {
//     return 'Hello World!';
//   }
// }

import { Injectable } from '@nestjs/common';
import {
  CircleDeveloperControlledWalletsClient,
  initiateDeveloperControlledWalletsClient,
} from '@circle-fin/developer-controlled-wallets';

import * as dotenv from 'dotenv';

dotenv.config();

@Injectable()
export class AppService {
  private client: CircleDeveloperControlledWalletsClient;

  constructor() {}

  async getHello(): Promise<string> {
    return 'hello world';
  }
}
