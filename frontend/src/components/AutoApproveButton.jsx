import { useState, useEffect } from 'react';
import { Clock, CheckCircle, Zap } from 'lucide-react';
import { getContract, waitForTransaction } from '../utils/web3';

function AutoApproveTimer({ projectId, milestoneId, submittedAt, onAutoApprove }) {
  const [canAutoApprove, setCanAutoApprove] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkAutoApproval();
    const interval = setInterval(checkAutoApproval, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [submittedAt]);

  const checkAutoApproval = () => {
    if (!submittedAt || submittedAt === 0) return;

    const now = Math.floor(Date.now() / 1000);
    const autoApproveTime = submittedAt + (7 * 24 * 60 * 60); // 7 days
    const secondsLeft = autoApproveTime - now;

    if (secondsLeft <= 0) {
      setCanAutoApprove(true);
      setTimeLeft('Auto-approval available now!');
    } else {
      setCanAutoApprove(false);
      const daysLeft = Math.floor(secondsLeft / (24 * 60 * 60));
      const hoursLeft = Math.floor((secondsLeft % (24 * 60 * 60)) / (60 * 60));
      const minutesLeft = Math.floor((secondsLeft % (60 * 60)) / 60);
      setTimeLeft(`${daysLeft}d ${hoursLeft}h ${minutesLeft}m until auto-approval`);
    }
  };

  const handleAutoApprove = async () => {
    setLoading(true);
    try {
      const contract = await getContract();
      const tx = await contract.autoApproveMilestone(projectId, milestoneId);
      await waitForTransaction(tx);
      if (onAutoApprove) {
        onAutoApprove();
      }
      alert('✅ Milestone auto-approved! Payment released to freelancer.');
    } catch (error) {
      console.error('Auto-approve error:', error);
      alert(error.message || 'Failed to auto-approve');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3">
          {canAutoApprove ? (
            <Zap className="w-6 h-6 text-yellow-500 animate-pulse mt-1" />
          ) : (
            <Clock className="w-6 h-6 text-blue-600 mt-1" />
          )}
          <div>
            <p className="text-sm font-semibold text-blue-900">
              {canAutoApprove ? '⚡ Auto-Approval Ready!' : '⏰ Auto-Approval Timer'}
            </p>
            <p className="text-xs text-blue-700 mt-1">{timeLeft}</p>
            {!canAutoApprove && (
              <p className="text-xs text-gray-600 mt-2">
                If client doesn't respond, payment will be automatically released
              </p>
            )}
          </div>
        </div>
        
        {canAutoApprove && (
          <button
            onClick={handleAutoApprove}
            disabled={loading}
            className="flex items-center space-x-2 bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-lg hover:from-green-600 hover:to-green-700 transition disabled:opacity-50 shadow-md"
          >
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">{loading ? 'Processing...' : 'Trigger Auto-Approve'}</span>
          </button>
        )}
      </div>
      
      {canAutoApprove && (
        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-xs text-yellow-800">
            💡 <strong>Anyone can trigger this!</strong> The 7-day waiting period has passed. 
            Click the button to release payment to the freelancer.
          </p>
        </div>
      )}
    </div>
  );
}

export default AutoApproveTimer;