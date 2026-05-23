import { Injectable, Logger } from '@nestjs/common';
import { RelayService } from '../relay/relay.service';
import { SwapChain } from '@circle-fin/app-kit';

@Injectable()
export class PriceService {
  private readonly logger = new Logger(PriceService.name);

  // Fallback mock prices in USD/USDC
  private readonly fallbackPrices: Record<string, number> = {
    USDC: 1.0,
    EURC: 1.08,
    cirBTC: 68000.0,
  };

  constructor(private readonly relayService: RelayService) {}

  /**
   * Fetches the USD price of a token on Arc Testnet.
   * If the on-chain estimate fails, falls back to mock prices.
   */
  async getPrice(token: string, evmAddress?: string): Promise<number> {
    const symbol = token.toUpperCase();
    if (symbol === 'USDC') {
      return 1.0;
    }

    // Default fallback address if none is provided
    const address = evmAddress || '0x3600000000000000000000000000000000000000';

    try {
      // Estimate 1 unit of token -> USDC
      const estimate = await this.relayService.estimateSwap(
        SwapChain.Arc_Testnet,
        address,
        symbol, // tokenIn (EURC / cirBTC)
        'USDC', // tokenOut (USDC)
        '1.0',  // amountIn
      );

      const price = parseFloat(estimate.estimatedOutput.amount);
      if (!isNaN(price) && price > 0) {
        this.logger.log(`Fetched on-chain price for ${symbol}: ${price} USDC`);
        return price;
      }
    } catch (error) {
      this.logger.warn(
        `Failed to fetch on-chain price for ${symbol}. Using fallback: ${this.fallbackPrices[symbol]}`,
      );
    }

    return this.fallbackPrices[symbol] ?? 0.0;
  }
}
