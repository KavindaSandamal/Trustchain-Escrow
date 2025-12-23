import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, FileText, DollarSign, Calendar, Loader } from 'lucide-react';
import {
  getReadOnlyContract,
  formatEther,
  ProjectStatus,
  getStatusColor,
  formatDate,
} from '../utils/web3';

function MyProjects({ account }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    loadMyProjects();
  }, [account]);

  const loadMyProjects = async () => {
    try {
      setLoading(true);
      const contract = await getReadOnlyContract();

      const projectIds = await contract.getUserProjects(account);
      
      const projectsData = [];
      for (let i = 0; i < projectIds.length; i++) {
        try {
          const projectId = Number(projectIds[i]);
          const project = await contract.projects(projectId);
          const milestones = await contract.getProjectMilestones(projectId);

          const completedMilestones = milestones.filter(
            (m) => Number(m.status) === 2
          ).length;

          projectsData.push({
            id: projectId,
            title: project.title,
            client: project.client,
            freelancer: project.freelancer,
            totalAmount: formatEther(project.totalAmount),
            status: Number(project.status),
            statusText: ProjectStatus[Number(project.status)],
            createdAt: Number(project.createdAt),
            acceptedAt: Number(project.acceptedAt),
            milestoneCount: milestones.length,
            completedMilestones,
            role:
              project.client.toLowerCase() === account.toLowerCase() ? 'client' : 'freelancer',
          });
        } catch (err) {
          console.error(`Error loading project ${i}:`, err);
        }
      }

      setProjects(projectsData);
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProjects = projects.filter((project) => {
    if (activeTab === 'all') return true;
    return project.role === activeTab;
  });

  const stats = {
    total: projects.length,
    asClient: projects.filter((p) => p.role === 'client').length,
    asFreelancer: projects.filter((p) => p.role === 'freelancer').length,
    completed: projects.filter((p) => p.status === 2).length,
    active: projects.filter((p) => p.status === 1).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Loading your projects...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Projects</h1>
        <p className="text-gray-600">Manage your projects as client or freelancer</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <p className="text-sm text-gray-600 mb-1">Total</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <p className="text-sm text-gray-600 mb-1">As Client</p>
          <p className="text-2xl font-bold text-blue-600">{stats.asClient}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <p className="text-sm text-gray-600 mb-1">As Freelancer</p>
          <p className="text-2xl font-bold text-purple-600">{stats.asFreelancer}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <p className="text-sm text-gray-600 mb-1">Active</p>
          <p className="text-2xl font-bold text-green-600">{stats.active}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <p className="text-sm text-gray-600 mb-1">Completed</p>
          <p className="text-2xl font-bold text-purple-600">{stats.completed}</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border mb-6">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition ${
              activeTab === 'all'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All Projects ({projects.length})
          </button>
          <button
            onClick={() => setActiveTab('client')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition ${
              activeTab === 'client'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            As Client ({stats.asClient})
          </button>
          <button
            onClick={() => setActiveTab('freelancer')}
            className={`flex-1 px-6 py-3 text-sm font-medium transition ${
              activeTab === 'freelancer'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            As Freelancer ({stats.asFreelancer})
          </button>
        </div>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-lg shadow-sm border">
          <Briefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 mb-4">
            {activeTab === 'client'
              ? "You haven't created any projects yet"
              : activeTab === 'freelancer'
              ? "You haven't accepted any projects yet"
              : 'No projects found'}
          </p>
          {activeTab !== 'freelancer' && (
            <Link
              to="/create"
              className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Create Your First Project
            </Link>
          )}
          {activeTab === 'freelancer' && (
            <Link
              to="/"
              className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Browse Available Projects
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProjects.map((project) => (
            <Link
              key={project.id}
              to={`/project/${project.id}`}
              className="block bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900">{project.title}</h3>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                          project.statusText
                        )}`}
                      >
                        {project.statusText}
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          project.role === 'client'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {project.role === 'client' ? 'Client' : 'Freelancer'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">Project ID: #{project.id}</p>
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-sm text-gray-600 mb-1">Total Budget</p>
                    <p className="text-2xl font-bold text-green-600">
                      {parseFloat(project.totalAmount).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-600">POL</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                  <div>
                    <div className="flex items-center text-sm text-gray-600 mb-1">
                      <Calendar className="w-4 h-4 mr-2" />
                      Created
                    </div>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDate(project.createdAt)}
                    </p>
                  </div>

                  {project.acceptedAt > 0 && (
                    <div>
                      <div className="flex items-center text-sm text-gray-600 mb-1">
                        <Calendar className="w-4 h-4 mr-2" />
                        Accepted
                      </div>
                      <p className="text-sm font-medium text-gray-900">
                        {formatDate(project.acceptedAt)}
                      </p>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center text-sm text-gray-600 mb-1">
                      <FileText className="w-4 h-4 mr-2" />
                      Milestones
                    </div>
                    <p className="text-sm font-medium text-gray-900">
                      {project.completedMilestones} / {project.milestoneCount} completed
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center text-sm text-gray-600 mb-1">
                      <DollarSign className="w-4 h-4 mr-2" />
                      Progress
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full transition-all"
                          style={{
                            width: `${
                              (project.completedMilestones / project.milestoneCount) * 100
                            }%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-900">
                        {Math.round((project.completedMilestones / project.milestoneCount) * 100)}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t">
                  {project.role === 'client' && project.status === 0 && (
                    <p className="text-sm text-blue-600">
                      ⏳ Waiting for freelancer to accept
                    </p>
                  )}
                  {project.role === 'freelancer' && project.status === 1 && (
                    <p className="text-sm text-blue-600">
                      📝 Click to submit milestones →
                    </p>
                  )}
                  {project.role === 'client' && project.status === 1 && (
                    <p className="text-sm text-blue-600">
                      👀 Click to review submitted work →
                    </p>
                  )}
                  {project.status === 2 && (
                    <p className="text-sm text-green-600">
                      ✓ Project completed successfully!
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyProjects;