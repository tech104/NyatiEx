import type { NetworkId } from "@/types/exchange";

// Element Pay (BaseFlow) Gateway Proxy contract addresses per network.
// These are the spenders the off-ramp service actually checks ERC-20 allowance
// against on-chain. Approving any other address will pass MetaMask but Element
// Pay will still report `current: 0`, causing a sell-approval loop.
//
// Source: https://github.com/element-pay/BaseFlow (mainnet contracts table) and
// the published BaseFlow `scripts/config.ts` for additional EVM networks.
export const ELEMENTPAY_SPENDER_ADDRESSES: Partial<Record<NetworkId, `0x${string}`>> = {
  // Base Gateway Proxy (mainnet)
  base: "0x30F6A8457F8E42371E204a9c103f2Bd42341dD0F",
  // Scroll Gateway (mainnet)
  scroll: "0x663C5BfE7d44bA946C2dd4b2D1Cf9580319F9338",
  // Polygon Gateway (mainnet)
  polygon: "0xfB411Cc6385Af50A562aFCb441864E9d541CDA67",
  // BNB Smart Chain Gateway (mainnet)
  "bnb-smart-chain": "0x1FA0EE7F9410F6fa49B7AD5Da72Cf01647090028",
  // Lisk: no verified Element Pay gateway address documented yet — leave out
  // until confirmed so we never approve the wrong contract.
};

// Minimal ERC20 ABI for approve + allowance + balanceOf + decimals
export const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

// Networks that support on-chain wallet interaction (have a verified Element
// Pay gateway). Lisk is intentionally excluded until a verified gateway address
// is available — approving the wrong contract caused a sell-approval loop.
export const WALLET_SUPPORTED_NETWORKS: NetworkId[] = [
  "base",
  "scroll",
  "polygon",
  "bnb-smart-chain",
];
