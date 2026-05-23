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
    CIRBTC: 68000.0,
  };

  constructor(private readonly relayService: RelayService) {}

  /**
   * Fetches the live price from Binance API.
   * Returns null if the fetch fails or symbol is unsupported.
   */
  async fetchLivePrice(symbol: string): Promise<number | null> {
    try {
      let binanceSymbol = '';
      if (symbol === 'EURC') {
        binanceSymbol = 'EURUSDT';
      } else if (symbol === 'CIRBTC') {
        binanceSymbol = 'BTCUSDT';
      } else {
        return null;
      }

      const res = await fetch(
        `https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`,
      );
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }
      const data = (await res.json()) as { price: string };
      const price = parseFloat(data.price);
      if (!isNaN(price) && price > 0) {
        return price;
      }
      return null;
    } catch (error) {
      this.logger.warn(
        `Failed to fetch live price from Binance for ${symbol}: ${error.message || error}`,
      );
      return null;
    }
  }

  /**
   * Fetches the USD price of a token.
   * Checks Binance live API first, falls back to Arc Testnet pool estimation, then static configs.
   */
  async getPrice(token: string, evmAddress?: string): Promise<number> {
    const symbol = token.toUpperCase();
    if (symbol === 'USDC') {
      return 1.0;
    }

    // Layer 1: Binance Live API
    const livePrice = await this.fetchLivePrice(symbol);
    if (livePrice !== null) {
      this.logger.log(
        `Fetched live Binance price for ${symbol}: ${livePrice} USDC`,
      );
      return livePrice;
    }

    // Layer 2: On-chain estimateSwap
    const address = evmAddress || '0x3600000000000000000000000000000000000000';
    try {
      const estimate = await this.relayService.estimateSwap(
        SwapChain.Arc_Testnet,
        address,
        symbol, // tokenIn (EURC / cirBTC)
        'USDC', // tokenOut (USDC)
        '1.0', // amountIn
      );

      const price = parseFloat(estimate.estimatedOutput.amount);
      if (!isNaN(price) && price > 0) {
        this.logger.log(`Fetched on-chain price for ${symbol}: ${price} USDC`);
        return price;
      }
    } catch (error) {
      this.logger.warn(
        `Failed to fetch on-chain price for ${symbol}. Using static fallback: ${this.fallbackPrices[symbol]}. Error: ${error.message || error}`,
      );
    }

    // Layer 3: Hardcoded mock/static fallback
    return this.fallbackPrices[symbol] ?? 0.0;
  }
}
