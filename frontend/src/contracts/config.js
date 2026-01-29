export const CONTRACT_ADDRESS = "0x626A276B629f93d558Cd93a45B0A07047D61250A"; 

export const AMOY_CHAIN_ID = 80002;
export const AMOY_RPC = "https://rpc-amoy.polygon.technology";

export const NETWORK_CONFIG = {
  chainId: `0x${AMOY_CHAIN_ID.toString(16)}`, // 0x13882
  chainName: 'Polygon Amoy Testnet',
  nativeCurrency: {
    name: 'POL',
    symbol: 'POL',
    decimals: 18,
  },
  rpcUrls: [AMOY_RPC],
  blockExplorerUrls: ['https://www.oklink.com/amoy'],
};