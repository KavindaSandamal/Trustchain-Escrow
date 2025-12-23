import { ethers } from 'ethers';
import ProjectEscrowABI from '../contracts/ProjectEscrow.json';
import { CONTRACT_ADDRESS, AMOY_CHAIN_ID, NETWORK_CONFIG } from '../contracts/config';

// Check if MetaMask is installed
export const isMetaMaskInstalled = () => {
  return typeof window.ethereum !== 'undefined';
};

// Connect to MetaMask
export const connectWallet = async () => {
  if (!isMetaMaskInstalled()) {
    throw new Error('Please install MetaMask!');
  }

  try {
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts',
    });

    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    if (parseInt(chainId, 16) !== AMOY_CHAIN_ID) {
      await switchToAmoy();
    }

    return accounts[0];
  } catch (error) {
    console.error('Error connecting wallet:', error);
    throw error;
  }
};

// Switch to Amoy network
export const switchToAmoy = async () => {
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: NETWORK_CONFIG.chainId }],
    });
  } catch (switchError) {
    if (switchError.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [NETWORK_CONFIG],
      });
    } else {
      throw switchError;
    }
  }
};

// Get provider and signer
export const getProviderAndSigner = async () => {
  if (!isMetaMaskInstalled()) {
    throw new Error('MetaMask not installed');
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  return { provider, signer };
};

// Get contract instance
export const getContract = async () => {
  const { signer } = await getProviderAndSigner();
  const contract = new ethers.Contract(
    CONTRACT_ADDRESS,
    ProjectEscrowABI.abi,
    signer
  );
  return contract;
};

// Get read-only contract instance
export const getReadOnlyContract = async () => {
  const provider = new ethers.JsonRpcProvider('https://rpc-amoy.polygon.technology');
  const contract = new ethers.Contract(
    CONTRACT_ADDRESS,
    ProjectEscrowABI.abi,
    provider
  );
  return contract;
};

// Format ether values
export const formatEther = (value) => {
  return ethers.formatEther(value);
};

export const parseEther = (value) => {
  return ethers.parseEther(value.toString());
};

// Format address for display
export const formatAddress = (address) => {
  if (!address) return '';
  return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
};

// Get account balance
export const getBalance = async (address) => {
  const { provider } = await getProviderAndSigner();
  const balance = await provider.getBalance(address);
  return formatEther(balance);
};

// Listen for account changes
export const onAccountsChanged = (callback) => {
  if (window.ethereum) {
    window.ethereum.on('accountsChanged', callback);
  }
};

// Listen for chain changes
export const onChainChanged = (callback) => {
  if (window.ethereum) {
    window.ethereum.on('chainChanged', callback);
  }
};

// Status enum mapping
export const ProjectStatus = {
  0: 'Created',
  1: 'Active',
  2: 'Completed',
  3: 'Cancelled',
  4: 'Disputed',
};

export const MilestoneStatus = {
  0: 'Pending',
  1: 'Submitted',
  2: 'Approved',
  3: 'Rejected',
  4: 'Disputed',
};

// Get status color
export const getStatusColor = (status) => {
  const colors = {
    Created: 'bg-blue-100 text-blue-800',
    Active: 'bg-green-100 text-green-800',
    Completed: 'bg-purple-100 text-purple-800',
    Cancelled: 'bg-red-100 text-red-800',
    Disputed: 'bg-yellow-100 text-yellow-800',
    Pending: 'bg-gray-100 text-gray-800',
    Submitted: 'bg-blue-100 text-blue-800',
    Approved: 'bg-green-100 text-green-800',
    Rejected: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

// Format date
export const formatDate = (timestamp) => {
  if (!timestamp || timestamp === 0) return 'N/A';
  const date = new Date(Number(timestamp) * 1000);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
};

// Wait for transaction
export const waitForTransaction = async (tx) => {
  const receipt = await tx.wait();
  return receipt;
};