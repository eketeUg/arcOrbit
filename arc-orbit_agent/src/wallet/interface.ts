export interface GatewayBalancesResponse {
  balances: Array<{
    domain: number;
    balance: string;
  }>;
}
