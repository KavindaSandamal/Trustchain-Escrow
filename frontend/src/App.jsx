import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Wallet, FileText, PlusCircle, AlertCircle, Shield } from 'lucide-react';
import {
  connectWallet,
  formatAddress,
  onAccountsChanged,
  onChainChanged,
  isMetaMaskInstalled,
} from './utils/web3';
import CreateProject from './components/CreateProject';
import ProjectList from './components/ProjectList';
import ProjectDetail from './components/ProjectDetail';
import MyProjects from './components/MyProjects';
import AdminDashboard from './components/AdminDashboard';

function App() {
  const [account, setAccount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    checkConnection();

    onAccountsChanged((accounts) => {
      if (accounts.length === 0) {
        setAccount('');
      } else {
        setAccount(accounts[0]);
      }
    });

    onChainChanged(() => {
      window.location.reload();
    });
  }, []);

  const checkConnection = async () => {
    if (isMetaMaskInstalled() && window.ethereum.selectedAddress) {
      setAccount(window.ethereum.selectedAddress);
    }
  };

  const handleConnect = async () => {
    setLoading(true);
    setError('');
    try {
      const address = await connectWallet();
      setAccount(address);
    } catch (err) {
      setError(err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        {/* Navigation */}
        <nav className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <Link to="/" className="flex items-center space-x-2">
                <FileText className="w-8 h-8 text-blue-600" />
                <span className="text-xl font-bold text-gray-900">
                  TrustChain Escrow
                </span>
              </Link>

              <div className="hidden md:flex space-x-8">
                <Link
                  to="/"
                  className="text-gray-700 hover:text-blue-600 transition"
                >
                  Browse Projects
                </Link>
                <Link
                  to="/create"
                  className="text-gray-700 hover:text-blue-600 transition"
                >
                  Create Project
                </Link>
                <Link
                  to="/my-projects"
                  className="text-gray-700 hover:text-blue-600 transition"
                >
                  My Projects
                </Link>
                <Link
                  to="/admin"
                  className="flex items-center space-x-1 text-gray-700 hover:text-blue-600 transition"
                >
                  <Shield className="w-4 h-4" />
                  <span>Admin</span>
                </Link>
              </div>

              <div>
                {account ? (
                  <div className="flex items-center space-x-3 bg-green-50 px-4 py-2 rounded-lg">
                    <Wallet className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-green-900">
                      {formatAddress(account)}
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={handleConnect}
                    disabled={loading}
                    className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    <Wallet className="w-5 h-5" />
                    <span>{loading ? 'Connecting...' : 'Connect Wallet'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </nav>

        {/* Error Alert */}
        {error && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-900">Error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {!account ? (
            <div className="text-center py-20">
              <Wallet className="w-20 h-20 text-gray-400 mx-auto mb-6" />
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Welcome to TrustChain Escrow
              </h2>
              <p className="text-gray-600 mb-8 max-w-2xl mx-auto">
                A decentralized escrow platform for freelancers and clients.
                Secure milestone-based payments with transparent dispute
                resolution.
              </p>
              <button
                onClick={handleConnect}
                className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition text-lg font-medium"
              >
                Connect Wallet to Get Started
              </button>
            </div>
          ) : (
            <Routes>
              <Route path="/" element={<ProjectList account={account} />} />
              <Route
                path="/create"
                element={<CreateProject account={account} />}
              />
              <Route
                path="/project/:id"
                element={<ProjectDetail account={account} />}
              />
              <Route
                path="/my-projects"
                element={<MyProjects account={account} />}
              />
              <Route
                path="/admin"
                element={<AdminDashboard account={account} />}
              />
            </Routes>
          )}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t mt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <p className="text-center text-gray-500 text-sm">
              © 2025 TrustChain Escrow. Built on Polygon Amoy Testnet.
            </p>
          </div>
        </footer>
      </div>
    </Router>
  );
}

export default App;