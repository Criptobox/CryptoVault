/** Token conocido por red — dirección, símbolo, decimales y CoinGecko id */
export interface KnownToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  cgId?: string;
  /** true = stablecoin (para métricas) */
  stable?: boolean;
}

const T = (
  address: string, symbol: string, name: string, decimals: number, cgId?: string, stable?: boolean,
): KnownToken => ({ address, symbol, name, decimals, cgId, stable });

export const KNOWN_TOKENS: Record<number, KnownToken[]> = {
  1: [
    T('0xdAC17F958D2ee523a2206206994597C13D831ec7', 'USDT', 'Tether USD', 6, 'tether', true),
    T('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 'USDC', 'USD Coin', 6, 'usd-coin', true),
    T('0x6B175474E89094C44Da98b954EedeAC495271d0F', 'DAI', 'Dai Stablecoin', 18, 'dai', true),
    T('0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', 'WBTC', 'Wrapped BTC', 8, 'wrapped-bitcoin'),
    T('0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84', 'stETH', 'Lido Staked ETH', 18, 'staked-ether'),
    T('0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0', 'wstETH', 'Wrapped stETH', 18, 'wrapped-steth'),
    T('0x514910771AF9Ca656af840dff83E8264EcF986CA', 'LINK', 'Chainlink', 18, 'chainlink'),
    T('0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', 'UNI', 'Uniswap', 18, 'uniswap'),
    T('0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', 'AAVE', 'Aave', 18, 'aave'),
    T('0x6982508145454Ce325dDbE47a25d4ec3d2311933', 'PEPE', 'Pepe', 18, 'pepe'),
    T('0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', 'SHIB', 'Shiba Inu', 18, 'shiba-inu'),
    T('0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32', 'LDO', 'Lido DAO', 18, 'lido-dao'),
    T('0x912CE59144191C1204E64559FE8253a0e49E6548', 'ARB', 'Arbitrum', 18, 'arbitrum'),
    T('0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0', 'MATIC', 'Polygon (ERC20)', 18, 'matic-network'),
    T('0xD533a949740bb3306d119CC777fa900bA034cd52', 'CRV', 'Curve DAO', 18, 'curve-dao-token'),
    T('0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2', 'MKR', 'Maker', 18, 'maker'),
    T('0xC011a73ee8576Fb9F942dC4eaFCfb957aff3eCB1', 'SNX', 'Synthetix', 18, 'havven'),
    T('0xc00e94Cb662C3520282E6f5717214004A7f26888', 'COMP', 'Compound', 18, 'compound-governance-token'),
  ],
  56: [
    T('0x55d398326f99059fF775485246999027B3197955', 'USDT', 'Tether USD (BSC)', 18, 'tether', true),
    T('0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', 'USDC', 'USD Coin (BSC)', 18, 'usd-coin', true),
    T('0x2170Ed0880ac9A755fd29B2688956BD959F933F8', 'ETH', 'Binance-Peg Ethereum', 18, 'ethereum'),
    T('0x7130d2A67B4DA2e0ae6e0E4E40d3C4B4A9Cb1e56', 'BTCB', 'Binance-Peg BTC', 18, 'bitcoin'),
    T('0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', 'CAKE', 'PancakeSwap', 18, 'pancakeswap-token'),
    T('0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3', 'DAI', 'Binance-Peg Dai', 18, 'dai', true),
    T('0xcF6BB5389c92Bdda8a37E7CF41BD8f7f4c6BE5ca', 'LINK', 'Chainlink (BSC)', 18, 'chainlink'),
    T('0xCC42724C6683497b192555f3E2513854D42c9b4D', 'GMD', 'GMDprotocol', 18),
  ],
  137: [
    T('0xc2132D05D31c914a87C6611C10748AEb04B58e8F', 'USDT', 'Tether USD (PoS)', 6, 'tether', true),
    T('0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', 'USDC', 'USD Coin (PoS)', 6, 'usd-coin', true),
    T('0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', 'DAI', 'Dai (PoS)', 18, 'dai', true),
    T('0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', 'WETH', 'Wrapped Ether (PoS)', 18, 'ethereum'),
    T('0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', 'WBTC', 'Wrapped BTC (PoS)', 8, 'wrapped-bitcoin'),
    T('0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39', 'LINK', 'Chainlink (PoS)', 18, 'chainlink'),
    T('0xD6DF932A45C0f255f85145f286eE0b291B9fB91f', 'stMATIC', 'Lido Staked MATIC', 18, 'staked-matic'),
    T('0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', 'WMATIC', 'Wrapped MATIC', 18, 'matic-network'),
  ],
  42161: [
    T('0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', 'USDT', 'Tether USD (Arb)', 6, 'tether', true),
    T('0xaf88d065e77c8cC2239327C5EDb3A432268e5831', 'USDC', 'USD Coin (Arb)', 6, 'usd-coin', true),
    T('0x912CE59144191C1204E64559FE8253a0e49E6548', 'ARB', 'Arbitrum', 18, 'arbitrum'),
    T('0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', 'WETH', 'Wrapped Ether (Arb)', 18, 'ethereum'),
    T('0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', 'WBTC', 'Wrapped BTC (Arb)', 8, 'wrapped-bitcoin'),
    T('0xf97f4df75117a78c1A5a0DBb814Af92458539FB4', 'LINK', 'Chainlink (Arb)', 18, 'chainlink'),
    T('0x539bdE0d7Dbd336b79148AA742883198BBF60342', 'MAGIC', 'Magic (Arb)', 18, 'magic-token'),
    T('0xf42Ae1D54fD62021E8C82D8a46f62Cb5D2889a30', 'PENDLE', 'Pendle (Arb)', 18, 'pendle'),
  ],
  8453: [
    T('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 'USDC', 'USD Coin (Base)', 6, 'usd-coin', true),
    T('0x4200000000000000000000000000000000000006', 'WETH', 'Wrapped Ether (Base)', 18, 'ethereum'),
    T('0x940181a94A35A4569E4529A3CDfB74E38FD98631', 'AERO', 'Aerodrome', 18, 'aerodrome-finance'),
    T('0x04C0599Ae5A0067c81E8CE923E91d53AA70eD5f9', 'DEGEN', 'Degen (Base)', 18, 'degen-base'),
    T('0x532f27101965dd16442E59d40670FaF5eBB142E4', 'BRETT', 'Brett (Base)', 18, 'based-brett'),
    T('0xd9aAEc86B65D86fF807B5E84792E0cE277044f97', 'cbBTC', 'Coinbase BTC', 8, 'coinbase-wrapped-btc'),
  ],
  10: [
    T('0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', 'USDT', 'Tether USD (OP)', 6, 'tether', true),
    T('0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', 'USDC', 'USD Coin (OP)', 6, 'usd-coin', true),
    T('0x4200000000000000000000000000000000000006', 'WETH', 'Wrapped Ether (OP)', 18, 'ethereum'),
    T('0x4200000000000000000000000000000000000042', 'OP', 'Optimism', 18, 'optimism'),
    T('0x68f180FcCe6836688e9084f035309E29Bf0A2095', 'WBTC', 'Wrapped BTC (OP)', 8, 'wrapped-bitcoin'),
    T('0x9560e827aF36c94D2Ac33a39b8D4ebDb93e8763f', 'VELO', 'Velodrome', 18, 'velodrome-finance'),
  ],
  43114: [
    T('0x9702230A8Ea53601f5cD2dc00fDBc13d4dF19497', 'USDT', 'Tether USD (Avax)', 6, 'tether', true),
    T('0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', 'USDC', 'USD Coin (Avax)', 6, 'usd-coin', true),
    T('0x6e84a6216eA6dacc71eE8E6b0a5B7322EEbC0eDd', 'JOE', 'Trader Joe', 18, 'trader-joe'),
    T('0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE', 'sAVAX', 'Benqi Staked AVAX', 18, 'benqi-liquid-staked-avax'),
    T('0xd586E7F844cEa2F87f50152665Bbc2f27B9BEBC0', 'DAI.e', 'Dai (Avalanche)', 18, 'dai', true),
    T('0x594737484D9bBd7a39b1B2d3D1Dc5D3dC5C6fF1E', 'LINK.e', 'Chainlink (Avax)', 18, 'chainlink'),
  ],
  250: [
    T('0x04068DA6C83AFCFA0e13ba15A6696662335D5B75', 'USDC', 'USD Coin (Fantom)', 6, 'usd-coin', true),
    T('0x049d68029688eAbF473097a2fC38ef61633A3C7A', 'fUSDT', 'Frapped USDT', 18, 'tether', true),
    T('0x8D11eC38a3EB5E956B052f67Da8Bdc9bef8Abf3E', 'DAI', 'Dai (Fantom)', 18, 'dai', true),
    T('0x21be370D5312f44cB42ce377BC9b8a0cEF1A4E83', 'WFTM', 'Wrapped Fantom', 18, 'fantom'),
    T('0x321162Cd933E2Be498Cd2267a90534A804051b11', 'BOO', 'SpookySwap', 18, 'booswap'),
  ],
  324: [
    T('0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', 'USDC', 'USD Coin (zkSync)', 6, 'usd-coin', true),
    T('0x493257fD37EDB454f8d0c41d22d1F0e4aB6FdA3D', 'USDT', 'Tether USD (zkSync)', 6, 'tether', true),
    T('0x3e7D1dCAE8E71B0d2acbCa1aBD0e3719B1C71E32', 'LINK', 'Chainlink (zkSync)', 18, 'chainlink'),
  ],
  59144: [
    T('0x176211869cA2b568f2A7D4EE941E073a821EE1ff', 'USDC', 'USD Coin (Linea)', 6, 'usd-coin', true),
    T('0xA219439258ca9da29E9Cc4cE5596924745e12B93', 'USDT', 'Tether USD (Linea)', 6, 'tether', true),
    T('0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f', 'WETH', 'Wrapped Ether (Linea)', 18, 'ethereum'),
  ],
  534352: [
    T('0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4', 'USDC', 'USD Coin (Scroll)', 6, 'usd-coin', true),
    T('0xf55BEC9cafDbE87358f11De614B23e68c0aA46F', 'USDT', 'Tether USD (Scroll)', 6, 'tether', true),
    T('0x5300000000000000000000000000000000000004', 'WETH', 'Wrapped Ether (Scroll)', 18, 'ethereum'),
  ],
  100: [
    T('0x2a22f9c3b484c3629090FeED35F17Ff8F88f76F0', 'USDC', 'USD Coin (Gnosis)', 6, 'usd-coin', true),
    T('0x4ECaBa5870353805a9F068101A40E0f32ed60fC6', 'USDT', 'Tether USD (Gnosis)', 6, 'tether', true),
    T('0x6A023CCd1ff6F2045C3309768eAd9E68F978f6e1', 'WETH', 'Wrapped Ether (Gnosis)', 18, 'ethereum'),
    T('0x9C58BAc37831cCe6fc47510391D13775f3698c28', 'GNO', 'Gnosis Token', 18, 'gnosis'),
  ],
  5000: [
    T('0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE', 'USDT', 'Tether USD (Mantle)', 6, 'tether', true),
    T('0x09a4228E85a3DdDc94aC9DD456137360F91D4E4F', 'USDC', 'USD Coin (Mantle)', 6, 'usd-coin', true),
    T('0x78adD4bDcBBD7C6f1aA0C43f9F1F1C2Fd5343f2D', 'WETH', 'Wrapped Ether (Mantle)', 18, 'ethereum'),
    T('0xDEe595DccfB04a79207e019C6De88B6D9Dc5Ab60', 'mETH', 'Mantle Staked ETH', 18, 'meth-protocol'),
  ],
  25: [
    T('0x66e428c3f67a68878562e79A0B4d9dcb20F71E09', 'USDT', 'Tether USD (Cronos)', 6, 'tether', true),
    T('0xc21223249CA28397B4B6541dfFaEcC538Bf9C9F9', 'USDC', 'USD Coin (Cronos)', 6, 'usd-coin', true),
    T('0x2D03bECE6747ADC00E1a131BBA1469C15fD11e03', 'VVS', 'VVS Finance', 18, 'vvs-finance'),
  ],
  1284: [
    T('0x931715FEE2d6173302506a50F3d190DF8c25B306', 'USDC', 'USD Coin (Moonbeam)', 6, 'usd-coin', true),
    T('0xe57eBdC4651781A50AE8C67C70aF79F0328F5a5F', 'USDT', 'Tether USD (Moonbeam)', 6, 'tether', true),
    T('0xAcc15dC74880C9944775448304B263D191c6077F', 'WGLMR', 'Wrapped GLMR', 18, 'moonbeam'),
  ],
  7700: [
    T('0x71352835c47176B05c2428072C08C5ec3D0ee5f3', 'NOTE', 'Canto Note', 8),
    T('0xcF1eF8889FcF69E6d198bEC026f0C1068CA2FbF1', 'USDC', 'USD Note (Canto)', 18, 'usd-coin', true),
    T('0x8Ee73c4986A10Fbf9d8e0683182bcF45EfAfB4c1', 'USDT', 'Tether USD (Canto)', 18, 'tether', true),
  ],
  1116: [
    T('0x40a9C9AC1A4f9F1D68a497Fde502e6D0E237D773', 'USDT', 'Tether USD (Core)', 18, 'tether', true),
    T('0xA217f5616b595cd2c25aA692A3a52512D32A4Ba3', 'USDC', 'USD Coin (Core)', 18, 'usd-coin', true),
  ],
  2222: [
    T('0xfE8D3206dDd821e319E29040F5D2d5A56D3EbE23', 'USDT', 'Tether USD (Kava)', 6, 'tether', true),
    T('0x765277EBeCc2c519C4e40a8e21e41d4C0c3F4492', 'USDC', 'USD Coin (Kava)', 6, 'usd-coin', true),
  ],
  42220: [
    T('0x765DE816845861e75A25fCA122bb6898B8B1282a', 'cUSD', 'Celo Dollar', 18, 'celo-dollar', true),
    T('0xD8763Cb2761a9c773C3e6eA4148A5eE4557feB98', 'cEUR', 'Celo Euro', 18, 'celo-euro', true),
    T('0xe8537a3d056DA446677B9E9d6C5db704EaAb4787', 'cREAL', 'Celo Real', 18, 'celo-real', true),
  ],
  1101: [
    T('0x4F9A0e7FD2Bf6067db69942512b14D4427BB58A0', 'USDC', 'USD Coin (zkEVM)', 6, 'usd-coin', true),
  ],
  130: [
    T('0x078D782b760474a361dDA0AF3839290b0EF57AD6', 'USDC', 'USD Coin (Unichain)', 6, 'usd-coin', true),
  ],
  1329: [
    T('0xe15fC38F6D8c56aF07bbCBe3BAf5708A2Bf42392', 'USDC', 'USD Coin (Sei)', 6, 'usd-coin', true),
  ],
};

/** Busca un token conocido por dirección (case-insensitive) */
export function findKnownToken(chainId: number, address: string): KnownToken | undefined {
  const list = KNOWN_TOKENS[chainId];
  if (!list) return undefined;
  const lower = address.toLowerCase();
  return list.find((t) => t.address.toLowerCase() === lower);
}
