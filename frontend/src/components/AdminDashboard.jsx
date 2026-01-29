import { useState, useEffect } from 'react';
import { Shield, Users, AlertCircle, CheckCircle, Pause, Play, UserPlus, UserMinus, Loader } from 'lucide-react';
import {
  getContract,
  getReadOnlyContract,
  waitForTransaction,
  formatEther,
  formatAddress,
  formatDate,
} from '../utils/web3';

function AdminDashboard({ account }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [adminList, setAdminList] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [newAdminAddress, setNewAdminAddress] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    checkAdminStatus();
    loadData();
  }, [account]);

  const checkAdminStatus = async () => {
    try {
      const contract = await getReadOnlyContract();
      const adminStatus = await contract.isAdmin(account);
      setIsAdmin(adminStatus);
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const contract = await getReadOnlyContract();

      // Load admin list
      const admins = await contract.getAdminList();
      setAdminList(admins);

      // Load pause status
      const paused = await contract.paused();
      setIsPaused(paused);

      // Load disputes
      const disputeCounter = await contract.disputeCounter();
      const count = Number(disputeCounter);

      const disputesData = [];
      for (let i = 0; i < count; i++) {
        try {
          const dispute = await contract.disputes(i);
          const [voteCount, resolved, voters, percentages] = await contract.getDisputeVotes(i);
          
          const project = await contract.projects(dispute.projectId);

          disputesData.push({
            id: i,
            projectId: Number(dispute.projectId),
            milestoneId: Number(dispute.milestoneId),
            initiator: dispute.initiator,
            reason: dispute.reason,
            isResolved: dispute.isResolved,
            createdAt: Number(dispute.createdAt),
            voteCount: Number(voteCount),
            voters: voters,
            percentages: percentages.map(p => Number(p)),
            projectTitle: project.title,
          });
        } catch (err) {
          console.error(`Error loading dispute ${i}:`, err);
        }
      }

      setDisputes(disputesData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAdmin = async () => {
    if (!newAdminAddress) {
      setError('Please enter an address');
      return;
    }

    // Validate Ethereum address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(newAdminAddress)) {
      setError('Invalid Ethereum address format. Must start with 0x followed by 40 hex characters');
      return;
    }

    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const contract = await getContract();
      const tx = await contract.addAdmin(newAdminAddress, { gasLimit: 150000 });
      await waitForTransaction(tx);
      setSuccess('✅ Admin added successfully!');
      setNewAdminAddress('');
      await loadData();
    } catch (err) {
      console.error('Add admin error:', err);
      setError(err.message || 'Failed to add admin');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveAdmin = async (adminAddress) => {
    if (!confirm(`Remove ${formatAddress(adminAddress)} as admin?`)) return;

    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const contract = await getContract();
      const tx = await contract.removeAdmin(adminAddress, { gasLimit: 150000 });
      await waitForTransaction(tx);
      setSuccess('✅ Admin removed successfully!');
      await loadData();
    } catch (err) {
      console.error('Remove admin error:', err);
      setError(err.message || 'Failed to remove admin');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePauseToggle = async () => {
    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const contract = await getContract();
      
      // Add gas limit to prevent estimation errors
      const gasLimit = 100000;
      
      const tx = isPaused 
        ? await contract.unpause({ gasLimit }) 
        : await contract.pause({ gasLimit });
      
      await waitForTransaction(tx);
      setSuccess(isPaused ? '▶️ Contract unpaused!' : '⏸️ Contract paused!');
      await loadData();
    } catch (err) {
      console.error('Pause toggle error:', err);
      setError(err.message || 'Failed to toggle pause');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVoteDispute = async (disputeId, percentage) => {
    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const contract = await getContract();
      const tx = await contract.voteOnDispute(disputeId, percentage, { gasLimit: 200000 });
      await waitForTransaction(tx);
      setSuccess('✅ Vote submitted successfully!');
      await loadData();
    } catch (err) {
      console.error('Vote error:', err);
      setError(err.message || 'Failed to vote');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Loading admin dashboard...</span>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-20">
        <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
        <p className="text-gray-600">You must be an admin to access this page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-2">
          <Shield className="w-8 h-8 text-blue-600" />
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        </div>
        <p className="text-gray-600">Manage platform settings and resolve disputes</p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-900">Error</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      {/* Contract Status */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Contract Status</h2>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {isPaused ? (
              <Pause className="w-6 h-6 text-red-600" />
            ) : (
              <Play className="w-6 h-6 text-green-600" />
            )}
            <div>
              <p className="text-sm font-medium text-gray-900">
                {isPaused ? 'Contract is Paused' : 'Contract is Active'}
              </p>
              <p className="text-xs text-gray-600">
                {isPaused ? 'All operations are currently disabled' : 'All operations are functioning normally'}
              </p>
            </div>
          </div>
          
          <button
            onClick={handlePauseToggle}
            disabled={actionLoading}
            className={`px-6 py-2 rounded-lg font-medium transition disabled:opacity-50 ${
              isPaused
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            {isPaused ? 'Unpause Contract' : 'Pause Contract'}
          </button>
        </div>
      </div>

      {/* Admin Management */}
      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Admin Management</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Add New Admin
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              value={newAdminAddress}
              onChange={(e) => setNewAdminAddress(e.target.value)}
              placeholder="0x..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleAddAdmin}
              disabled={actionLoading}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              <UserPlus className="w-5 h-5" />
              <span>Add</span>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700 mb-2">Current Admins ({adminList.length})</p>
          {adminList.map((admin, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <Shield className="w-5 h-5 text-blue-600" />
                <span className="font-mono text-sm">{formatAddress(admin)}</span>
                {admin.toLowerCase() === account.toLowerCase() && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">You</span>
                )}
              </div>
              
              {adminList.length > 1 && (
                <button
                  onClick={() => handleRemoveAdmin(admin)}
                  disabled={actionLoading}
                  className="flex items-center space-x-1 text-red-600 hover:text-red-700 text-sm disabled:opacity-50"
                >
                  <UserMinus className="w-4 h-4" />
                  <span>Remove</span>
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Disputes */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Dispute Resolution ({disputes.filter(d => !d.isResolved).length} pending)
        </h2>

        {disputes.length === 0 ? (
          <p className="text-center text-gray-500 py-8">No disputes to review</p>
        ) : (
          <div className="space-y-4">
            {disputes.map((dispute) => (
              <div key={dispute.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-semibold text-gray-900">Dispute #{dispute.id}</h3>
                      {dispute.isResolved ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                          Resolved
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded-full">
                          Pending
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">Project: {dispute.projectTitle}</p>
                    <p className="text-xs text-gray-500">
                      Raised by: {formatAddress(dispute.initiator)} on {formatDate(dispute.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded p-3 mb-3">
                  <p className="text-sm font-medium text-gray-700 mb-1">Reason:</p>
                  <p className="text-sm text-gray-600">{dispute.reason}</p>
                </div>

                {/* Voting Status */}
                {dispute.voteCount > 0 && (
                  <div className="mb-3">
                    <p className="text-sm font-medium text-gray-700 mb-2">
                      Votes: {dispute.voteCount}/{2} required
                    </p>
                    <div className="space-y-1">
                      {dispute.voters.map((voter, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs">
                          <span className="font-mono">{formatAddress(voter)}</span>
                          <span className="font-medium">{dispute.percentages[idx]}% to freelancer</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Vote Actions */}
                {!dispute.isResolved && !dispute.voters.includes(account) && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">Cast Your Vote:</p>
                    <div className="grid grid-cols-5 gap-2">
                      {[0, 25, 50, 75, 100].map((percentage) => (
                        <button
                          key={percentage}
                          onClick={() => handleVoteDispute(dispute.id, percentage)}
                          disabled={actionLoading}
                          className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50 text-sm"
                        >
                          {percentage}%
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500">% to freelancer (rest goes to client)</p>
                  </div>
                )}

                {!dispute.isResolved && dispute.voters.includes(account) && (
                  <p className="text-sm text-green-600">✓ You have already voted on this dispute</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;