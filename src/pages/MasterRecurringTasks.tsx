import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { RotateCcw, Calendar, Filter, Search, Trash2, Users, Paperclip, FileText, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import axios from 'axios';
import ViewToggle from '../components/ViewToggle';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import TaskTypeBadge from '../components/TaskTypeBadge';
import { useTheme } from '../contexts/ThemeContext';

interface Attachment {
  filename: string;
  originalName: string;
  path: string;
  size: number;
  uploadedAt: string;
}

interface Task {
  _id: string;
  title: string;
  description: string;
  taskType: string;
  assignedBy: { username: string; email: string };
  assignedTo: { username: string; email: string };
  dueDate: string;
  priority: string;
  status: string;
  parentTaskInfo?: {
    includeSunday: boolean;
    isForever: boolean;
  };
  lastCompletedDate?: string;
  createdAt: string;
  attachments: Attachment[];
}

interface User {
  _id: string;
  username: string;
  email: string;
}

// ReadMore component
interface ReadMoreProps {
  text: string;
  maxLength: number;
}

const ReadMore: React.FC<ReadMoreProps> = ({ text, maxLength }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (text.length <= maxLength) {
    return <p className="text-[--color-textSecondary] text-sm mb-4">{text}</p>;
  }

  const displayedText = isExpanded ? text : `${text.substring(0, maxLength)}...`;

  return (
    <p className="text-[--color-textSecondary] text-sm mb-4">
      {displayedText}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="ml-1 text-[--color-primary] hover:text-[--color-primary-dark] font-medium"
      >
        {isExpanded ? 'See Less' : 'See More'}
      </button>
    </p>
  );
};

// Helper function to detect mobile devices
const isMobileDevice = () => {
  return window.innerWidth < 768;
};

// Helper function to get initial view preference
const getInitialViewPreference = (): 'table' | 'card' => {
  const savedView = localStorage.getItem('taskViewPreference');
  
  if (savedView === 'table' || savedView === 'card') {
    return savedView;
  }
  
  return isMobileDevice() ? 'card' : 'table';
};

// Helper function to format date for input
const formatDateForInput = (date: Date) => {
  return date.toISOString().split('T')[0];
};

// Helper function to filter tasks based on all criteria
const filterTasks = (tasks: Task[], filter: any) => {
  return tasks.filter((task: Task) => {
    // Search filter
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      const matchesSearch = 
        task.title.toLowerCase().includes(searchLower) ||
        task.description.toLowerCase().includes(searchLower) ||
        task.assignedTo.username.toLowerCase().includes(searchLower) ||
        task.assignedBy.username.toLowerCase().includes(searchLower);
      
      if (!matchesSearch) return false;
    }

    // Task type filter
    if (filter.taskType && task.taskType !== filter.taskType) {
      return false;
    }

    // Status filter
    if (filter.status && task.status !== filter.status) {
      return false;
    }

    // Priority filter
    if (filter.priority && task.priority !== filter.priority) {
      return false;
    }

    // Assigned to filter
    if (filter.assignedTo && task.assignedTo._id !== filter.assignedTo) {
      return false;
    }

    // Date range filter
    if (filter.dateFrom || filter.dateTo) {
      const taskDate = new Date(task.dueDate);
      
      if (filter.dateFrom) {
        const fromDate = new Date(filter.dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (taskDate < fromDate) return false;
      }
      
      if (filter.dateTo) {
        const toDate = new Date(filter.dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (taskDate > toDate) return false;
      }
    }

    return true;
  });
};

const MasterRecurringTasks: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'table' | 'card'>(getInitialViewPreference);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [filter, setFilter] = useState({
    taskType: '',
    status: '',
    priority: '',
    assignedTo: '',
    search: '',
    dateFrom: '',
    dateTo: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showAttachmentsModal, setShowAttachmentsModal] = useState<Attachment[] | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);

  const descriptionMaxLength = 100;

  // Check if current user is admin
  const isAdmin = user?.role === 'admin' || user?.permissions?.canViewAllTeamTasks || false;

  // Calculate pagination
  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentTasks = filteredTasks.slice(startIndex, endIndex);

  useEffect(() => {
    fetchTasks();
    if (isAdmin) {
      fetchUsers();
    }
  }, [user, isAdmin]);

  // Apply filters whenever filter state or allTasks changes
  useEffect(() => {
    const filtered = filterTasks(allTasks, filter);
    setFilteredTasks(filtered);
    setCurrentPage(1); // Reset to first page when filters change
  }, [allTasks, filter]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        taskType: 'daily,weekly,monthly,yearly',
        page: '1',
        limit: '1000000' // Fetch all tasks to handle filtering on frontend
      });

      // For non-admin users, filter by their assigned tasks
      if (!isAdmin && user?.id) {
        params.append('assignedTo', user.id);
      }

      const response = await axios.get(`http://localhost:5000/api/tasks?${params}`);

      let tasks = response.data.tasks.filter((task: Task) =>
        ['daily', 'weekly', 'monthly', 'yearly'].includes(task.taskType)
      );

      setAllTasks(tasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (window.confirm('Are you sure you want to delete this recurring task?')) {
      try {
        await axios.delete(`http://localhost:5000/api/tasks/${taskId}`);
        fetchTasks();
      } catch (error) {
        console.error('Error deleting task:', error);
      }
    }
  };

  const resetFilters = () => {
    setFilter({ 
      taskType: '', 
      status: '', 
      priority: '', 
      assignedTo: '', 
      search: '',
      dateFrom: '',
      dateTo: ''
    });
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page
  };

  // Helper to determine if a filename is an image
  const isImage = (filename: string) => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
    const lowercasedFilename = filename.toLowerCase();
    return imageExtensions.some(ext => lowercasedFilename.endsWith(ext));
  };

  const renderCardView = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
      {currentTasks.map((task) => (
        <div
          key={task._id}
          className="bg-[--color-background] rounded-xl shadow-sm border border-[--color-border] hover:shadow-md transition-all duration-200 overflow-hidden"
        >
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-[--color-text] line-clamp-2">
                {task.title}
              </h3>
              {user?.permissions?.canDeleteTasks && (
                <button
                  onClick={() => handleDeleteTask(task._id)}
                  className="p-2 text-[--color-error] hover:bg-[--color-error-light] rounded-lg transition-colors ml-2"
                  title="Delete task"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              <TaskTypeBadge taskType={task.taskType} />
              <StatusBadge status={task.status} />
              <PriorityBadge priority={task.priority} />
              {task.parentTaskInfo?.isForever && (
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-[--color-primary-light] text-[--color-primary]">
                  FOREVER
                </span>
              )}
            </div>

            <ReadMore text={task.description} maxLength={descriptionMaxLength} />

            <div className="space-y-2 text-sm text-[--color-textSecondary]">
              <div className="flex justify-between">
                <span>Assigned by:</span>
                <span className="font-medium">{task.assignedBy.username}</span>
              </div>
              {isAdmin && (
                <div className="flex justify-between">
                  <span>Assigned to:</span>
                  <span className="font-medium">{task.assignedTo.username}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="flex items-center">
                  <Paperclip size={14} className="mr-1" />
                  Attachments:
                </span>
                {task.attachments && task.attachments.length > 0 ? (
                  <button
                    onClick={() => setShowAttachmentsModal(task.attachments)}
                    className="font-medium text-[--color-primary] hover:text-[--color-primary-dark]"
                  >
                    Click Here ({task.attachments.length})
                  </button>
                ) : (
                  <span>No Attachments</span>
                )}
              </div>
              <div className="flex justify-between">
                <span>Due date:</span>
                <span className="font-medium">
                  {new Date(task.dueDate).toLocaleDateString()}
                </span>
              </div>
              {task.lastCompletedDate && (
                <div className="flex justify-between">
                  <span>Last completed:</span>
                  <span className="font-medium">
                    {new Date(task.lastCompletedDate).toLocaleDateString()}
                  </span>
                </div>
              )}
              {task.parentTaskInfo && (
                <div className="flex justify-between">
                  <span>Include Sunday:</span>
                  <span className="font-medium">{task.parentTaskInfo.includeSunday ? 'Yes' : 'No'}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderTableView = () => (
    <div className="bg-[--color-background] rounded-xl shadow-sm border border-[--color-border] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[--color-border]">
          <thead className="bg-[--color-surface]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-[--color-textSecondary] uppercase tracking-wider">
                Task
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[--color-textSecondary] uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[--color-textSecondary] uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[--color-textSecondary] uppercase tracking-wider">
                Priority
              </th>
              {isAdmin && (
                <th className="px-6 py-3 text-left text-xs font-medium text-[--color-textSecondary] uppercase tracking-wider">
                  Assigned To
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-[--color-textSecondary] uppercase tracking-wider">
                Attachments
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[--color-textSecondary] uppercase tracking-wider">
                Due Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[--color-textSecondary] uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-[--color-background] divide-y divide-[--color-border]">
            {currentTasks.map((task) => (
              <tr key={task._id} className="hover:bg-[--color-surface] transition-colors">
                <td className="px-6 py-4">
                  <div>
                    <div className="text-sm font-medium text-[--color-text] mb-1">
                      {task.title}
                    </div>
                    <ReadMore text={task.description} maxLength={descriptionMaxLength} />
                    <div className="flex items-center mt-2 space-x-2">
                      {task.parentTaskInfo?.isForever && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[--color-primary-light] text-[--color-primary]">
                          FOREVER
                        </span>
                      )}
                      {task.parentTaskInfo && (
                        <span className="text-xs text-[--color-textSecondary]">
                          Sunday: {task.parentTaskInfo.includeSunday ? 'Yes' : 'No'}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <TaskTypeBadge taskType={task.taskType} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <StatusBadge status={task.status} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <PriorityBadge priority={task.priority} />
                </td>
                {isAdmin && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-[--color-text]">{task.assignedTo.username}</div>
                    <div className="text-sm text-[--color-textSecondary]">{task.assignedTo.email}</div>
                  </td>
                )}
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {task.attachments && task.attachments.length > 0 ? (
                    <button
                      onClick={() => setShowAttachmentsModal(task.attachments)}
                      className="font-medium text-[--color-primary] hover:text-[--color-primary-dark]"
                    >
                      Click Here ({task.attachments.length})
                    </button>
                  ) : (
                    <span className="text-[--color-textSecondary]">No Attachments</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-[--color-text]">
                    {new Date(task.dueDate).toLocaleDateString()}
                  </div>
                  {task.lastCompletedDate && (
                    <div className="text-xs text-[--color-textSecondary]">
                      Last: {new Date(task.lastCompletedDate).toLocaleDateString()}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {user?.permissions?.canDeleteTasks && (
                    <button
                      onClick={() => handleDeleteTask(task._id)}
                      className="text-[--color-error] hover:text-[--color-error-dark] transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[--color-primary]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] p-4 space-y-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-[--color-text]">
            Master Recurring Tasks
            {isAdmin && <span className="text-xs font-normal text-[--color-primary] ml-2">(Admin View - All Team)</span>}
          </h1>
          <p className="mt-1 text-xs text-[--color-textSecondary]">
            {filteredTasks.length} of {allTasks.length} recurring task(s) found
            {isAdmin ? ' (All team members)' : ' (Your tasks)'} 
          </p>
        </div>
        <div className="flex items-center mt-4 sm:mt-0">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2 text-sm font-medium text-[--color-textSecondary] bg-[--color-surface] hover:bg-[--color-border] rounded-lg transition-colors flex items-center mr-4"
            title={showFilters ? "Hide Filters" : "Show Filters"}
          >
            <Filter size={16} className="inline mr-2" />
            {showFilters ? "Hide Filters" : "Show Filters"}
          </button>
          <ViewToggle view={view} onViewChange={setView} />
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-[--color-background] rounded-xl shadow-sm border border-[--color-border] p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {/* Date From */}
            <div>
              <label className="block text-sm font-medium text-[--color-text] mb-1">
                <Calendar size={14} className="inline mr-1" />
                Date From
              </label>
              <input
                type="date"
                value={filter.dateFrom}
                onChange={(e) => setFilter({ ...filter, dateFrom: e.target.value })}
                className="w-full text-sm px-3 py-2 border border-[--color-border] rounded-lg focus:ring-2 focus:ring-[--color-primary] focus:border-[--color-primary] bg-[--color-surface] text-[--color-text]"
              />
            </div>

            {/* Date To */}
            <div>
              <label className="block text-sm font-medium text-[--color-text] mb-1">
                <Calendar size={14} className="inline mr-1" />
                Date To
              </label>
              <input
                type="date"
                value={filter.dateTo}
                onChange={(e) => setFilter({ ...filter, dateTo: e.target.value })}
                className="w-full text-sm px-3 py-2 border border-[--color-border] rounded-lg focus:ring-2 focus:ring-[--color-primary] focus:border-[--color-primary] bg-[--color-surface] text-[--color-text]"
              />
            </div>

            {/* Task Type */}
            <div>
              <label className="block text-sm font-medium text-[--color-text] mb-1">
                Task Type
              </label>
              <select
                value={filter.taskType}
                onChange={(e) => setFilter({ ...filter, taskType: e.target.value })}
                className="w-full text-sm px-3 py-2 border border-[--color-border] rounded-lg focus:ring-2 focus:ring-[--color-primary] focus:border-[--color-primary] bg-[--color-surface] text-[--color-text]"
              >
                <option value="">All Types</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-[--color-text] mb-1">
                Status
              </label>
              <select
                value={filter.status}
                onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                className="w-full text-sm px-3 py-2 border border-[--color-border] rounded-lg focus:ring-2 focus:ring-[--color-primary] focus:border-[--color-primary] bg-[--color-surface] text-[--color-text]"
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="overdue">Overdue</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-[--color-text] mb-1">
                Priority
              </label>
              <select
                value={filter.priority}
                onChange={(e) => setFilter({ ...filter, priority: e.target.value })}
                className="w-full text-sm px-3 py-2 border border-[--color-border] rounded-lg focus:ring-2 focus:ring-[--color-primary] focus:border-[--color-primary] bg-[--color-surface] text-[--color-text]"
              >
                <option value="">All Priorities</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </div>

            {/* Team Member Filter (Admin only) */}
            {isAdmin && (
              <div>
                <label className="block text-sm font-medium text-[--color-text] mb-1">
                  <Users size={14} className="inline mr-1" />
                  Team Member
                </label>
                <select
                  value={filter.assignedTo}
                  onChange={(e) => setFilter({ ...filter, assignedTo: e.target.value })}
                  className="w-full text-sm px-3 py-2 border border-[--color-border] rounded-lg focus:ring-2 focus:ring-[--color-primary] focus:border-[--color-primary] bg-[--color-surface] text-[--color-text]"
                >
                  <option value="">All Members</option>
                  {users.map((teamUser) => (
                    <option key={teamUser._id} value={teamUser._id}>
                      {teamUser.username}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Search */}
            <div className={`${isAdmin ? 'md:col-span-2' : 'md:col-span-1'}`}>
              <label className="block text-sm font-medium text-[--color-text] mb-1">
                <Search size={14} className="inline mr-1" />
                Search
              </label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[--color-textSecondary]" />
                <input
                  type="text"
                  placeholder="Search tasks, descriptions, users..."
                  value={filter.search}
                  onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                  className="w-full pl-10 pr-3 py-2 text-sm border border-[--color-border] rounded-lg focus:ring-2 focus:ring-[--color-primary] focus:border-[--color-primary] bg-[--color-surface] text-[--color-text]"
                />
              </div>
            </div>

            {/* Clear Filters Button */}
            <div className="flex items-end">
              <button
                onClick={resetFilters}
                className="px-4 py-2 text-sm font-medium text-[--color-text] bg-[--color-surface] hover:bg-[--color-border] rounded-lg transition-colors flex items-center"
              >
                <RotateCcw size={16} className="inline mr-1" />
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {filteredTasks.length === 0 ? (
        <div className="text-center py-12">
          <RotateCcw size={48} className="mx-auto mb-4 text-[--color-textSecondary]" />
          <p className="text-lg text-[--color-textSecondary]">
            {Object.values(filter).some(value => value !== '') 
              ? 'No recurring tasks match your filters'
              : 'No recurring tasks found'}
          </p>
          {Object.values(filter).some(value => value !== '') && (
            <button
              onClick={resetFilters}
              className="mt-4 px-4 py-2 text-sm font-medium text-[--color-primary] hover:text-[--color-primary-dark] transition-colors"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <>
          {view === 'card' ? renderCardView() : renderTableView()}

          {/* Enhanced Pagination */}
          {totalPages > 1 && (
            <div className="bg-[--color-background] rounded-xl shadow-sm border border-[--color-border] p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                {/* Items per page selector */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-[--color-textSecondary]">Show:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                    className="text-sm px-2 py-1 border border-[--color-border] rounded-lg focus:ring-2 focus:ring-[--color-primary] focus:border-[--color-primary] bg-[--color-surface] text-[--color-text]"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                  <span className="text-sm text-[--color-textSecondary]">per page</span>
                </div>

                {/* Page info */}
                <div className="flex items-center">
                  <p className="text-sm text-[--color-textSecondary]">
                    Showing <span className="font-medium">{startIndex + 1}</span> to{' '}
                    <span className="font-medium">{Math.min(endIndex, filteredTasks.length)}</span> of{' '}
                    <span className="font-medium">{filteredTasks.length}</span> results
                  </p>
                </div>

                {/* Pagination controls */}
                <div className="flex items-center space-x-1">
                  {/* First page */}
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                    className="p-2 text-sm font-medium text-[--color-textSecondary] bg-[--color-surface] border border-[--color-border] rounded-lg hover:bg-[--color-border] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="First page"
                  >
                    <ChevronsLeft size={16} />
                  </button>

                  {/* Previous page */}
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-2 text-sm font-medium text-[--color-textSecondary] bg-[--color-surface] border border-[--color-border] rounded-lg hover:bg-[--color-border] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Previous page"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {/* Page numbers */}
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNumber;
                      if (totalPages <= 5) {
                        pageNumber = i + 1;
                      } else if (currentPage <= 3) {
                        pageNumber = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNumber = totalPages - 4 + i;
                      } else {
                        pageNumber = currentPage - 2 + i;
                      }

                      return (
                        <button
                          key={pageNumber}
                          onClick={() => handlePageChange(pageNumber)}
                          className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                            currentPage === pageNumber
                              ? 'bg-[--color-primary] text-white'
                              : 'text-[--color-textSecondary] bg-[--color-surface] border border-[--color-border] hover:bg-[--color-border]'
                          }`}
                        >
                          {pageNumber}
                        </button>
                      );
                    })}
                  </div>

                  {/* Next page */}
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-2 text-sm font-medium text-[--color-textSecondary] bg-[--color-surface] border border-[--color-border] rounded-lg hover:bg-[--color-border] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Next page"
                  >
                    <ChevronRight size={16} />
                  </button>

                  {/* Last page */}
                  <button
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages}
                    className="p-2 text-sm font-medium text-[--color-textSecondary] bg-[--color-surface] border border-[--color-border] rounded-lg hover:bg-[--color-border] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    title="Last page"
                  >
                    <ChevronsRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Attachments Modal */}
      {showAttachmentsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-[--color-surface] rounded-xl max-w-xl w-full shadow-2xl transform transition-all">
            <div className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center text-[--color-text]">
                <Paperclip size={20} className="mr-2" />
                Task Attachments
              </h3>
              {showAttachmentsModal.length > 0 ? (
                <ul className="space-y-3 max-h-96 overflow-y-auto pr-2">
                  {showAttachmentsModal.map((attachment, index) => (
                    <li key={index} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 rounded-lg bg-[--color-background] text-[--color-text]">
                      <div className="flex items-center mb-2 sm:mb-0 sm:mr-4">
                        {isImage(attachment.filename) ? (
                          <>
                            <img
                              src={`http://localhost:5000/uploads/${attachment.filename}`}
                              alt={attachment.originalName}
                              className="w-16 h-16 object-cover rounded-md mr-3 border border-[--color-border] cursor-pointer"
                              onClick={() => setSelectedImagePreview(`http://localhost:5000/uploads/${attachment.filename}`)}
                            />
                            <span className="text-sm font-medium break-all">{attachment.originalName}</span>
                          </>
                        ) : (
                          <>
                            <FileText size={40} className="mr-3 text-[--color-primary]" />
                            <span className="text-sm font-medium break-all">{attachment.originalName}</span>
                          </>
                        )}
                      </div>
                      {isImage(attachment.filename) ? (
                        <div className="flex items-center shrink-0 mt-2 sm:mt-0 space-x-2">
                          <button
                            onClick={() => window.open(`http://localhost:5000/uploads/${attachment.filename}`, '_blank')}
                            className="text-sm font-medium text-[--color-primary] hover:text-[--color-primary-dark] flex items-center"
                          >
                            View
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <a
                            href={`http://localhost:5000/uploads/${attachment.filename}`}
                            download
                            className="text-sm font-medium text-[--color-primary] hover:text-[--color-primary-dark] flex items-center"
                          >
                            Download
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                          </a>
                        </div>
                      ) : (
                        <a
                          href={`http://localhost:5000/uploads/${attachment.filename}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-[--color-primary] hover:text-[--color-primary-dark] flex items-center shrink-0 mt-2 sm:mt-0"
                          download
                        >
                          Download
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[--color-textSecondary]">No attachments for this task.</p>
              )}
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowAttachmentsModal(null)}
                  className="py-2 px-4 rounded-lg font-medium transition-colors hover:bg-[--color-background] bg-[--color-surface] border border-[--color-border] text-[--color-text]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full-screen Image Preview Modal */}
      {selectedImagePreview && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImagePreview(null)}
        >
          <div
            className="relative"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={selectedImagePreview}
              alt="Full Screen Preview"
              className="max-w-full max-h-[90vh] object-contain cursor-pointer"
              onClick={() => setSelectedImagePreview(null)}
            />
            <button
              onClick={() => setSelectedImagePreview(null)}
              className="absolute top-4 right-4 text-white text-3xl bg-black bg-opacity-50 rounded-full w-10 h-10 flex items-center justify-center hover:bg-opacity-75 transition-opacity"
              title="Close"
            >
              &times;
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterRecurringTasks;




