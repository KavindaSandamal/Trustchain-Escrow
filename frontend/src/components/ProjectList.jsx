import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Calendar, DollarSign, User, Loader } from 'lucide-react';
import {
  getReadOnlyContract,
  formatEther,
  formatAddress,
  ProjectStatus,
  getStatusColor,
  formatDate,
} from '../utils/web3';

function ProjectList({ account }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const contract = await getReadOnlyContract();

      const projectCounter = await contract.projectCounter();
      const count = Number(projectCounter);

      const projectsData = [];
      for (let i = 0; i < count; i++) {
        try {
          const project = await contract.projects(i);
          const milestones = await contract.getProjectMilestones(i);

          projectsData.push({
            id: i,
            title: project.title,
            client: project.client,
            freelancer: project.freelancer,
            totalAmount: formatEther(project.totalAmount),
            status: Number(project.status),
            statusText: ProjectStatus[Number(project.status)],
            createdAt: Number(project.createdAt),
            acceptedAt: Number(project.acceptedAt),
            milestoneCount: milestones.length,
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
    const matchesSearch = project.title.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesFilter = true;
    if (filter === 'available') {
      matchesFilter = project.status === 0;
    } else if (filter === 'active') {
      matchesFilter = project.status === 1;
    }

    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Loading projects...</span>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Browse Projects</h1>
        <p className="text-gray-600">Find projects to work on and start earning</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Projects</option>
            <option value="available">Available</option>
            <option value="active">Active</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <p className="text-sm text-gray-600 mb-1">Total Projects</p>
          <p className="text-2xl font-bold text-gray-900">{projects.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <p className="text-sm text-gray-600 mb-1">Available</p>
          <p className="text-2xl font-bold text-green-600">
            {projects.filter((p) => p.status === 0).length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <p className="text-sm text-gray-600 mb-1">Active</p>
          <p className="text-2xl font-bold text-blue-600">
            {projects.filter((p) => p.status === 1).length}
          </p>
        </div>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-lg shadow-sm border">
          <p className="text-gray-500 mb-4">No projects found</p>
          <Link
            to="/create"
            className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Create First Project
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <Link
              key={project.id}
              to={`/project/${project.id}`}
              className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                      project.statusText
                    )}`}
                  >
                    {project.statusText}
                  </span>
                  <span className="text-sm text-gray-500">#{project.id}</span>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                  {project.title}
                </h3>

                <div className="flex items-center space-x-2 mb-4">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  <span className="text-2xl font-bold text-gray-900">
                    {parseFloat(project.totalAmount).toFixed(2)}
                  </span>
                  <span className="text-gray-600">POL</span>
                </div>

                <div className="space-y-2 text-sm text-gray-600 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center">
                      <User className="w-4 h-4 mr-2" />
                      Client
                    </span>
                    <span className="font-mono text-xs">{formatAddress(project.client)}</span>
                  </div>

                  {project.freelancer !== '0x0000000000000000000000000000000000000000' && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center">
                        <User className="w-4 h-4 mr-2" />
                        Freelancer
                      </span>
                      <span className="font-mono text-xs">{formatAddress(project.freelancer)}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      Created
                    </span>
                    <span>{new Date(project.createdAt * 1000).toLocaleDateString()}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span>Milestones</span>
                    <span className="font-medium">{project.milestoneCount}</span>
                  </div>
                </div>

                {project.status === 0 &&
                  project.client.toLowerCase() !== account.toLowerCase() && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm text-blue-600 font-medium text-center">
                        Click to view and accept →
                      </p>
                    </div>
                  )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default ProjectList;