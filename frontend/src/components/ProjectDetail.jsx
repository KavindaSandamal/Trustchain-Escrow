import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  Upload,
  AlertTriangle,
  Loader,
  DollarSign,
  Calendar,
  User,
} from 'lucide-react';
import {
  getContract,
  getReadOnlyContract,
  formatEther,
  formatAddress,
  ProjectStatus,
  MilestoneStatus,
  getStatusColor,
  formatDate,
  waitForTransaction,
} from '../utils/web3';

function ProjectDetail({ account }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deliverableHash, setDeliverableHash] = useState('');
  const [disputeReason, setDisputeReason] = useState('');

  useEffect(() => {
    loadProject();
  }, [id]);

  const loadProject = async () => {
    try {
      setLoading(true);
      const contract = await getReadOnlyContract();

      const projectData = await contract.projects(id);
      const milestonesData = await contract.getProjectMilestones(id);

      setProject({
        id: Number(id),
        title: projectData.title,
        client: projectData.client,
        freelancer: projectData.freelancer,
        totalAmount: formatEther(projectData.totalAmount),
        status: Number(projectData.status),
        statusText: ProjectStatus[Number(projectData.status)],
        createdAt: Number(projectData.createdAt),
        acceptedAt: Number(projectData.acceptedAt),
      });

      setMilestones(
        milestonesData.map((m, index) => ({
          id: index,
          description: m.description,
          amount: formatEther(m.amount),
          deadline: Number(m.deadline),
          status: Number(m.status),
          statusText: MilestoneStatus[Number(m.status)],
          deliverableHash: m.deliverableHash,
          submittedAt: Number(m.submittedAt),
        }))
      );
    } catch (error) {
      console.error('Error loading project:', error);
      setError('Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptProject = async () => {
    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const contract = await getContract();
      const tx = await contract.acceptProject(id);
      setSuccess('Accepting project...');
      await waitForTransaction(tx);
      setSuccess('✅ Project accepted successfully!');
      await loadProject();
    } catch (err) {
      console.error('Error accepting project:', err);
      setError(err.message || 'Failed to accept project');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmitMilestone = async (milestoneId) => {
    if (!deliverableHash) {
      setError('Please enter deliverable hash');
      return;
    }

    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const contract = await getContract();
      const tx = await contract.submitMilestone(id, milestoneId, deliverableHash);
      setSuccess('Submitting milestone...');
      await waitForTransaction(tx);
      setSuccess('✅ Milestone submitted successfully!');
      setDeliverableHash('');
      await loadProject();
    } catch (err) {
      console.error('Error submitting milestone:', err);
      setError(err.message || 'Failed to submit milestone');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveMilestone = async (milestoneId) => {
    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const contract = await getContract();
      const tx = await contract.approveMilestone(id, milestoneId);
      setSuccess('Approving milestone and releasing payment...');
      await waitForTransaction(tx);
      setSuccess('✅ Milestone approved and payment released!');
      await loadProject();
    } catch (err) {
      console.error('Error approving milestone:', err);
      setError(err.message || 'Failed to approve milestone');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRaiseDispute = async (milestoneId) => {
    if (!disputeReason) {
      setError('Please enter dispute reason');
      return;
    }

    setActionLoading(true);
    setError('');
    setSuccess('');

    try {
      const contract = await getContract();
      const tx = await contract.raiseDispute(id, milestoneId, disputeReason);
      setSuccess('Raising dispute...');
      await waitForTransaction(tx);
      setSuccess('✅ Dispute raised successfully!');
      setDisputeReason('');
      await loadProject();
    } catch (err) {
      console.error('Error raising dispute:', err);
      setError(err.message || 'Failed to raise dispute');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Loading project...</span>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-600 mb-4">Project not found</p>
        <button
          onClick={() => navigate('/')}
          className="text-blue-600 hover:text-blue-700"
        >
          ← Back to Projects
        </button>
      </div>
    );
  }

  const isClient = project.client.toLowerCase() === account.toLowerCase();
  const isFreelancer = project.freelancer.toLowerCase() === account.toLowerCase();
  const canAccept =
    project.status === 0 &&
    project.freelancer === '0x0000000000000000000000000000000000000000' &&
    !isClient;

  return (
    <div className="max-w-5xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>Back</span>
      </button>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
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

      <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{project.title}</h1>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                  project.statusText
                )}`}
              >
                {project.statusText}
              </span>
            </div>
            <p className="text-gray-600">Project ID: #{project.id}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-600 mb-1">Total Budget</p>
            <p className="text-3xl font-bold text-green-600">
              {parseFloat(project.totalAmount).toFixed(2)} POL
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
          <div className="flex items-center space-x-3">
            <User className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-600">Client</p>
              <p className="font-mono text-sm">{formatAddress(project.client)}</p>
              {isClient && <span className="text-xs text-blue-600">(You)</span>}
            </div>
          </div>

          {project.freelancer !== '0x0000000000000000000000000000000000000000' && (
            <div className="flex items-center space-x-3">
              <User className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Freelancer</p>
                <p className="font-mono text-sm">{formatAddress(project.freelancer)}</p>
                {isFreelancer && <span className="text-xs text-blue-600">(You)</span>}
              </div>
            </div>
          )}

          <div className="flex items-center space-x-3">
            <Calendar className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-600">Created</p>
              <p className="text-sm">{formatDate(project.createdAt)}</p>
            </div>
          </div>

          {project.acceptedAt > 0 && (
            <div className="flex items-center space-x-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Accepted</p>
                <p className="text-sm">{formatDate(project.acceptedAt)}</p>
              </div>
            </div>
          )}
        </div>

        {canAccept && (
          <div className="mt-6 pt-6 border-t">
            <button
              onClick={handleAcceptProject}
              disabled={actionLoading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-medium"
            >
              {actionLoading ? 'Accepting...' : 'Accept This Project'}
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Milestones</h2>

        <div className="space-y-6">
          {milestones.map((milestone) => (
            <div key={milestone.id} className="border border-gray-200 rounded-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Milestone {milestone.id + 1}
                    </h3>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        milestone.statusText
                      )}`}
                    >
                      {milestone.statusText}
                    </span>
                  </div>
                  <p className="text-gray-700">{milestone.description}</p>
                </div>
                <div className="text-right ml-4">
                  <p className="text-2xl font-bold text-gray-900">
                    {parseFloat(milestone.amount).toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-600">POL</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-4">
                <div>
                  <p className="font-medium mb-1">Deadline</p>
                  <p>{formatDate(milestone.deadline)}</p>
                </div>
                {milestone.submittedAt > 0 && (
                  <div>
                    <p className="font-medium mb-1">Submitted</p>
                    <p>{formatDate(milestone.submittedAt)}</p>
                  </div>
                )}
              </div>

              {milestone.deliverableHash && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium text-gray-700 mb-2">Deliverable</p>
                  <p className="text-sm text-gray-600 font-mono break-all">
                    {milestone.deliverableHash}
                  </p>
                </div>
              )}

              <div className="pt-4 border-t">
                {isFreelancer && milestone.status === 0 && project.status === 1 && (
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Enter deliverable hash (e.g., IPFS hash)"
                      value={deliverableHash}
                      onChange={(e) => setDeliverableHash(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={() => handleSubmitMilestone(milestone.id)}
                      disabled={actionLoading}
                      className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center space-x-2"
                    >
                      <Upload className="w-5 h-5" />
                      <span>{actionLoading ? 'Submitting...' : 'Submit Work'}</span>
                    </button>
                  </div>
                )}

                {isClient && milestone.status === 1 && (
                  <div className="space-y-3">
                    <button
                      onClick={() => handleApproveMilestone(milestone.id)}
                      disabled={actionLoading}
                      className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition disabled:opacity-50 flex items-center justify-center space-x-2"
                    >
                      <CheckCircle className="w-5 h-5" />
                      <span>{actionLoading ? 'Approving...' : 'Approve & Release Payment'}</span>
                    </button>

                    <details className="text-sm">
                      <summary className="cursor-pointer text-red-600 hover:text-red-700 font-medium">
                        Raise Dispute
                      </summary>
                      <div className="mt-3 space-y-2">
                        <textarea
                          placeholder="Explain the issue..."
                          value={disputeReason}
                          onChange={(e) => setDisputeReason(e.target.value)}
                          rows="3"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        />
                        <button
                          onClick={() => handleRaiseDispute(milestone.id)}
                          disabled={actionLoading}
                          className="w-full bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
                        >
                          {actionLoading ? 'Raising Dispute...' : 'Raise Dispute'}
                        </button>
                      </div>
                    </details>
                  </div>
                )}

                {milestone.status === 2 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                    <p className="text-sm text-green-800 font-medium">
                      ✓ Milestone Approved - Payment Released
                    </p>
                  </div>
                )}

                {milestone.status === 4 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                    <p className="text-sm text-yellow-800 font-medium">
                      ⚠ Dispute Raised - Awaiting Resolution
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ProjectDetail;