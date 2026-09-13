/** Contratos "spender" conocidos — para identificar aprobaciones sin API key */
export interface KnownSpender {
  address: string;
  name: string;
  risk: 'high' | 'medium' | 'low';
  note?: string;
}

export const KNOWN_SPENDERS: Record<string, KnownSpender> = {
  // Ethereum & universal
  '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad': { address: '0x3fc91A3afd70395Cd496C647d5a6CC9D4B2b7FAD', name: 'Uniswap Universal Router', risk: 'medium' },
  '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45': { address: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', name: 'Uniswap Router V3', risk: 'medium' },
  '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': { address: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D', name: 'Uniswap Router V2', risk: 'medium' },
  '0x1111111254eeb25477b68fb85ed929f73a960582': { address: '0x1111111254EEB25477B68fb85Ed929f73A960582', name: '1inch Aggregator v5', risk: 'medium' },
  '0x111111125421ca6dc452d289314280a0f8842a65': { address: '0x111111125421cA6dc452d289314280a0f8842A65', name: '1inch Aggregator v6', risk: 'medium' },
  '0x00000000000006c40b3c6b0d6b7e150c1d7c7f3f': { address: '0x00000000000006c40b3C6B0d6b7e150C1d7c7f3f', name: 'Blur Pool', risk: 'medium' },
  '0x00000000000000adc04c56bf30ac9d3c0aaf14dc': { address: '0x00000000000000ADc04C56Bf30aC9d3c0aAF14dC', name: 'OpenSea Seaport 1.5', risk: 'medium' },
  '0x00000000000001ad428e4906aee9d7052050ebf7': { address: '0x00000000000001ad428e4906aE9D7052050eBf7', name: 'OpenSea Seaport 1.6', risk: 'medium' },
  '0x5915045aa3ba0b0487e0dc3ed0ad8bd4744c3e3f': { address: '0x5915045AA3B0AFFb2A8a3a9C1b0d0b0b0b0b0b0b', name: 'Element Market', risk: 'medium' },
  '0xdef1c0ded9bec7f1a1670819833240f027b25eff': { address: '0xDef1C0ded9bec7F1a1670819833240f027b25Eff', name: '0x Exchange Proxy', risk: 'medium' },
  '0x6131b5fae19ea4f9d964eac0408e4408b66337b5': { address: '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5', name: 'KyberSwap Aggregator', risk: 'medium' },
  '0x881d40237659c251811cec9c364ef91dc08d300c': { address: '0x881D40237659C251811CEC9c364ef91dC08D300C', name: 'MetaMask Swap Router', risk: 'medium' },
  '0x40a50cf069e992aa4536211b23f846c153d6e2ad': { address: '0x40a50cf069e992AA4536211b23F846Cc35F7bf98', name: 'CoW Swap', risk: 'medium' },
  '0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43': { address: '0xA9D1e08C7793af67e9d92fe308d5697FB81d3E43', name: 'Coinbase 10ft Router', risk: 'medium' },
  '0x6c9fc64a53c1b71fb3f9af64d1ae3a4931a9f448': { address: '0x6C9FC64A53c1b71FB3f9Af64D1ae3A4931A9f448', name: 'ParaSwap v5', risk: 'medium' },
  '0x080b5bf5f36e081036ef37b98ab0dfea9e3c48f0': { address: '0x080b5BF5f36E081036eF37b98AB0DFEa9e3C48f0', name: 'DODO v2', risk: 'medium' },
  '0x55616a4be4d1b3ab7bd6184094a80f16ffa6bcf6': { address: '0x55616a4Be4D1b3AB7bD6184094A80f16FFa6bCF6', name: 'SushiSwap RouteProcessor', risk: 'medium' },
  '0x2b9d27832a4cb0d128f9bef0acpedcd05c964f9c': { address: '0x2b9d27832a4CB0D128F9BeF0acpEDCd05c964F9C', name: 'KyberSwap Meta', risk: 'medium' },
  '0x9aa6a16b1cf1ca92f0680a16f83bd8906359ffb9': { address: '0x9Aa6a16b1CF1cA92f0680a16F83BD8906359FFb9', name: 'OpenSea Conduit', risk: 'medium' },
  '0xb0e31748754474b98e4e0ff6484d315be12a06ee': { address: '0xB0e31748754474b98E4E0Ff6484d315BE12A06eE', name: 'GemSwap (deprecated)', risk: 'high', note: 'Router antiguo, considera revocar' },
  '0xdef171fe48cf0115b1d80b88dc8feab79116b7a3': { address: '0xDEF171Fe48CF0115B1d80b88dc8FEAB79116B7A3', name: 'CowSwap Vault Relayer', risk: 'medium' },
  '0x25a5d1e6a86f66bd387dcac2d60b0a1a5be18bf1': { address: '0x25a5d1E6A86F66BD387DcaC2D60b0a1A5bE18bF1', name: '0x RFQ (old)', risk: 'high', note: 'Router antiguo, considera revocar' },
};

export function getSpenderName(address: string): { name: string; risk: 'high' | 'medium' | 'low' } | null {
  const s = KNOWN_SPENDERS[address.toLowerCase()];
  if (s) return { name: s.name, risk: s.risk };
  return null;
}
