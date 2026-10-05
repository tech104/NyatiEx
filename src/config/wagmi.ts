import { base, polygon, bsc, arbitrum, mainnet, celo, lisk, scroll } from "viem/chains";

const chains = [base, polygon, bsc, arbitrum, mainnet, celo, lisk, scroll] as const;

export type SupportedChainId = (typeof chains)[number]["id"];
export const SUPPORTED_CHAINS = chains;
export const CHAIN_BY_ID: Record<SupportedChainId, (typeof chains)[number]> = Object.fromEntries(
  chains.map((chain) => [chain.id, chain])
) as Record<SupportedChainId, (typeof chains)[number]>;

export const RPC_URLS: Record<SupportedChainId, string[]> = {
  [base.id]: [
    "https://base.llamarpc.com",
    "https://base-rpc.publicnode.com",
    "https://mainnet.base.org",
    "https://base.drpc.org",
  ],
  [polygon.id]: [
    "https://polygon-bor-rpc.publicnode.com",
    "https://polygon.llamarpc.com",
    "https://polygon-rpc.com",
    "https://polygon.drpc.org",
  ],
  [bsc.id]: [
    "https://bsc-rpc.publicnode.com",
    "https://binance.llamarpc.com",
    "https://bsc-dataseed.bnbchain.org",
    "https://bsc.drpc.org",
  ],
  [arbitrum.id]: [
    "https://arbitrum-one-rpc.publicnode.com",
    "https://arbitrum.llamarpc.com",
    "https://arb1.arbitrum.io/rpc",
    "https://arbitrum.drpc.org",
  ],
  [mainnet.id]: [
    "https://ethereum-rpc.publicnode.com",
    "https://eth.llamarpc.com",
    "https://cloudflare-eth.com",
    "https://eth.drpc.org",
  ],
  [celo.id]: [
    "https://forno.celo.org",
    "https://celo-rpc.publicnode.com",
    "https://celo.drpc.org",
  ],
  [lisk.id]: [
    "https://rpc.api.lisk.com",
    "https://lisk.drpc.org",
  ],
  [scroll.id]: [
    "https://scroll-rpc.publicnode.com",
    "https://rpc.scroll.io",
    "https://scroll.drpc.org",
  ],
};

export const NETWORK_TO_CHAIN_ID: Record<string, SupportedChainId> = {
  base: base.id,
  polygon: polygon.id,
  "bnb-smart-chain": bsc.id,
  "arbitrum-one": arbitrum.id,
  ethereum: mainnet.id,
  celo: celo.id,
  lisk: lisk.id,
  scroll: scroll.id,
};

export const CHAIN_ID_TO_NETWORK: Record<number, string> = Object.fromEntries(
  Object.entries(NETWORK_TO_CHAIN_ID).map(([k, v]) => [v, k])
);
