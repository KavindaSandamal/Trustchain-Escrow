import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, Trash2, Calendar, DollarSign, AlertCircle } from 'lucide-react';
import { getContract, parseEther, waitForTransaction } from '../utils/web3';

function CreateProject({ account }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
  });

  const [milestones, setMilestones] = useState([
    {
      description: '',
      amount: '',
      deadline: '',
    },
  ]);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleMilestoneChange = (index, field, value) => {
    const newMilestones = [...milestones];
    newMilestones[index][field] = value;
    setMilestones(newMilestones);
  };

  const addMilestone = () => {
    setMilestones([
      ...milestones,
      {
        description: '',
        amount: '',
        deadline: '',
      },
    ]);
  };

  const removeMilestone = (index) => {
    if (milestones.length > 1) {
      const newMilestones = milestones.filter((_, i) => i !== index);
      setMilestones(newMilestones);
    }
  };

  const calculateTotal = () => {
    return milestones.reduce((sum, m) => {
      return sum + (parseFloat(m.amount) || 0);
    }, 0);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (!formData.title || !formData.description) {
        throw new Error('Please fill in all project details');
      }

      for (let i = 0; i < milestones.length; i++) {
        if (!milestones[i].description || !milestones[i].amount || !milestones[i].deadline) {
          throw new Error(`Please complete milestone ${i + 1}`);
        }
        if (parseFloat(milestones[i].amount) <= 0) {
          throw new Error(`Milestone ${i + 1} amount must be greater than 0`);
        }
      }

      const total = calculateTotal();
      if (total <= 0) {
        throw new Error('Total amount must be greater than 0');
      }

      const contract = await getContract();

      const descriptionHash = `ipfs://description-${Date.now()}`;
      const milestoneDescriptions = milestones.map((m) => m.description);
      const milestoneAmounts = milestones.map((m) => parseEther(m.amount));
      const milestoneDeadlines = milestones.map((m) => {
        return Math.floor(new Date(m.deadline).getTime() / 1000);
      });

      console.log('Creating project...');
      const tx = await contract.createProject(
        formData.title,
        descriptionHash,
        milestoneDescriptions,
        milestoneAmounts,
        milestoneDeadlines,
        {
          value: parseEther(total.toString()),
        }
      );

      setSuccess('Transaction submitted! Waiting for confirmation...');
      await waitForTransaction(tx);

      setSuccess('✅ Project created successfully!');
      setTimeout(() => {
        navigate('/my-projects');
      }, 2000);
    } catch (err) {
      console.error('Error creating project:', err);
      setError(err.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Project</h1>
        <p className="text-gray-600">
          Post a project with milestone-based payments. Funds will be held in escrow until work is
          approved.
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
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

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Project Details</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Title *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                placeholder="e.g., Build a React Website"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Description *
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Describe your project requirements, expected deliverables, and any specific requirements..."
                rows="6"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Milestones</h2>
            <button
              type="button"
              onClick={addMilestone}
              className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              <PlusCircle className="w-5 h-5" />
              <span>Add Milestone</span>
            </button>
          </div>

          <div className="space-y-4">
            {milestones.map((milestone, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-gray-900">Milestone {index + 1}</h3>
                  {milestones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMilestone(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description *
                    </label>
                    <input
                      type="text"
                      value={milestone.description}
                      onChange={(e) =>
                        handleMilestoneChange(index, 'description', e.target.value)
                      }
                      placeholder="e.g., Design mockups"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <DollarSign className="w-4 h-4 inline mr-1" />
                        Amount (POL) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={milestone.amount}
                        onChange={(e) => handleMilestoneChange(index, 'amount', e.target.value)}
                        placeholder="0.00"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <Calendar className="w-4 h-4 inline mr-1" />
                        Deadline *
                      </label>
                      <input
                        type="datetime-local"
                        value={milestone.deadline}
                        onChange={(e) => handleMilestoneChange(index, 'deadline', e.target.value)}
                        min={new Date().toISOString().slice(0, 16)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Total Project Cost</h3>
              <p className="text-sm text-gray-600 mt-1">
                This amount will be deposited into escrow
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-blue-600">{calculateTotal().toFixed(2)}</p>
              <p className="text-sm text-gray-600">POL</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Creating Project...' : 'Create Project & Deposit Funds'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateProject;