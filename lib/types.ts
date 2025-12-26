export type OkxItem = {
  name?: string;
  amount?: string;
  ownerAddress?: string;
  tokenId?: string;
  tickerIcon?: string;
  unitPrice?: { satPrice?: string; price?: string; usdPrice?: string };
  totalPrice?: { price?: string; satPrice?: string; usdPrice?: string };
};

export type OkxResponse = {
  code?: number;
  data?: {
    count?: number;
    cursor?: string;
    hasNext?: boolean;
    items?: OkxItem[];
  };
};

export type ComputeResult = {
  ok: boolean;
  threshold: number;
  pagesFetched: number;
  totalCount: number;
  matchedItems: number;
  matchedAmount: number;
  matchedBTC: number;
  btcusdt: number | null;
  matchedUSD: number | null;
  nextCursor: string | null;
  elapsedMs: number;
  sample: boolean;
  items: Array<{
    name: string;
    amount: number;
    unitSats: number;
    totalBTC: number;
    owner: string;
    tokenId: string;
    icon: string;
  }>;
  warnings: string[];
};
