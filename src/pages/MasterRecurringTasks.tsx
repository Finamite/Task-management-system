import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { RotateCcw, Calendar, Filter, Search, Trash2, Users, Paperclip, FileText, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Edit3, Save, X } from 'lucide-react';
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
  taskGroupId?: string;
  sequenceNumber?: number;
  parentTaskInfo?: {
    originalStartDate?: string;
    originalEndDate?: string;
    includeSunday: boolean;
    isForever: boolean;
    weeklyDays?: number[];
    monthlyDay?: number;
    yearlyDuration?: number;
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

interface MasterTask {
  taskGroupId: string;
  title: string;
  description: string;
  taskType: string;
  assignedBy: { username: string; email: string };
  assignedTo: { username: string; email: string };
  priority: string;
  parentTaskInfo?: {
    originalStartDate?: string;
    originalEndDate?: string;
    includeSunday: boolean;
    isForever: boolean;
    weeklyDays?: number[];
    monthlyDay?: number;
    yearlyDuration?: number;
  };
  attachments: Attachment[];
  instanceCount: number;
  completedCount: number;
  pendingCount: number;
  tasks: Task[];
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

// Helper function to group tasks by taskGroupId
const groupTasksByGroupId = (tasks: Task[]): MasterTask[] => {
  const groupedTasks: { [key: string]: Task[] } = {};
  
  tasks.forEach(task => {
    const groupId = task.taskGroupId || task._id;
    if (!groupedTasks[groupId]) {
      groupedTasks[groupId] = [];
    }
    groupedTasks[groupId].push(task);
  });

  return Object.entries(groupedTasks).map(([groupId, groupTasks]) => {
    const firstTask = groupTasks[0];
    const completedCount = groupTasks.filter(t => t.status === 'completed').length;
    const pendingCount = groupTasks.filter(t => t.status === 'pending').length;
    
    return {
      taskGroupId: groupId,
      title: firstTask.title,
      description: firstTask.description,
      taskType: firstTask.taskType,
      assignedBy: firstTask.assignedBy,
      assignedTo: firstTask.assignedTo,
      priority: firstTask.priority,
      parentTaskInfo: firstTask.parentTaskInfo,
      attachments: firstTask.attachments,
      instanceCount: groupTasks.length,
      completedCount,
      pendingCount,
      tasks: groupTasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    };
  });
};

const MasterRecurringTasks: React.FC = () => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [masterTasks, setMasterTasks] = useState<MasterTask[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'table' | 'card'>(getInitialViewPreference);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingMasterTask, setEditingMasterTask] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<any>({});
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

  // Check if user can edit recurring task schedules
  const canEditRecurringTaskSchedules = user?.permissions?.canEditRecurringTaskSchedules || false;

  // Check if user can delete tasks
  const canDeleteTasks = user?.permissions?.canDeleteTasks || false;

  // Check if user has any actions available for master tasks
  const hasMasterTaskActions = canEditRecurringTaskSchedules || canDeleteTasks;

  // Calculate pagination based on current view mode
  const currentData = isEditMode ? masterTasks : filteredTasks;
  const totalPages = Math.ceil(currentData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentItems = currentData.slice(startIndex, endIndex);

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
    
    // Update master tasks when tasks change
    const grouped = groupTasksByGroupId(filtered);
    setMasterTasks(grouped);
    
    setCurrentPage(1); // Reset to first page when filters change
  }, [allTasks, filter]);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        taskType: 'daily,weekly,monthly,quarterly,yearly',
        page: '1',
        limit: '1000000' // Fetch all tasks to handle filtering on frontend
      });

      // For non-admin users, filter by their assigned tasks
      if (!isAdmin && user?.id) {
        params.append('assignedTo', user.id);
      }

      const response = await axios.get(`http://localhost:5000/api/tasks?${params}`);

      let tasks = response.data.tasks.filter((task: Task) =>
        ['daily', 'weekly', 'monthly','quarterly', 'yearly'].includes(task.taskType)
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

  const handleDeleteMasterTask = async (masterTask: MasterTask) => {
    if (window.confirm(`Are you sure you want to delete all ${masterTask.instanceCount} instances of this recurring task series?`)) {
      try {
        // Delete all tasks in the group
        await Promise.all(masterTask.tasks.map(task => 
          axios.delete(`http://localhost:5000/api/tasks/${task._id}`)
        ));
        fetchTasks();
      } catch (error) {
        console.error('Error deleting master task:', error);
      }
    }
  };

  const handleEditMasterTask = (masterTask: MasterTask) => {
    setEditingMasterTask(masterTask.taskGroupId);
    const formData: any = {
      title: masterTask.title,
      description: masterTask.description,
      priority: masterTask.priority,
      assignedTo: masterTask.assignedTo._id,
    };

    setEditFormData(formData);
  };

  const handleSaveMasterTask = async (masterTask: MasterTask) => {
    try {
      // Prepare update data - only basic fields, no scheduling fields
      const updateData: any = {
        title: editFormData.title,
        description: editFormData.description,
        priority: editFormData.priority,
        assignedTo: editFormData.assignedTo,
      };

      // Update all tasks in the group
      await Promise.all(masterTask.tasks.map(task => 
        axios.put(`http://localhost:5000/api/tasks/${task._id}`, updateData)
      ));
      
      setEditingMasterTask(null);
      setEditFormData({});
      fetchTasks();
    } catch (error) {
      console.error('Error saving master task:', error);
    }
  };

  const handleCancelEdit = () => {
    setEditingMasterTask(null);
    setEditFormData({});
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

  const renderMasterTaskEditForm = (masterTask: MasterTask) => {
    if (editingMasterTask !== masterTask.taskGroupId) {
      return null;
    }

    return (
      <div className="bg-[--color-surface] rounded-lg p-6 border border-[--color-border] mb-4">
        <h4 className="text-lg font-semibold text-[--color-text] mb-4">Edit Master Task</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-[--color-text] mb-1">Title</label>
            <input
              type="text"
              value={editFormData.title || ''}
              onChange={(e) => setEditFormData({...editFormData, title: e.target.value})}
              className="w-full px-3 py-2 border border-[--color-border] rounded-lg focus:ring-2 focus:ring-[--color-primary] focus:border-[--color-primary] bg-[--color-background] text-[--color-text]"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-[--color-text] mb-1">Priority</label>
            <select
              value={editFormData.priority || ''}
              onChange={(e) => setEditFormData({...editFormData, priority: e.target.value})}
              className="w-full px-3 py-2 border border-[--color-border] rounded-lg focus:ring-2 focus:ring-[--color-primary] focus:border-[--color-primary] bg-[--color-background] text-[--color-text]"
            >
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </div>

          {/* Assigned To */}
          {isAdmin && (
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[--color-text] mb-1">Assigned To</label>
              <select
                value={editFormData.assignedTo || ''}
                onChange={(e) => setEditFormData({...editFormData, assignedTo: e.target.value})}
                className="w-full px-3 py-2 border border-[--color-border] rounded-lg focus:ring-2 focus:ring-[--color-primary] focus:border-[--color-primary] bg-[--color-background] text-[--color-text]"
              >
                {users.map(user => (
                  <option key={user._id} value={user._id}>{user.username}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Description */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-[--color-text] mb-1">Description</label>
          <textarea
            value={editFormData.description || ''}
            onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
            rows={3}
            className="w-full px-3 py-2 border border-[--color-border] rounded-lg focus:ring-2 focus:ring-[--color-primary] focus:border-[--color-primary] bg-[--color-background] text-[--color-text]"
          />
        </div>

        {/* Action buttons */}
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={handleCancelEdit}
            className="px-4 py-2 text-sm font-medium text-[--color-text] bg-[--color-surface] border border-[--color-border] rounded-lg hover:bg-[--color-background] transition-colors"
          >
            <X size={16} className="inline mr-1" />
            Cancel
          </button>
          <button
            onClick={() => handleSaveMasterTask(masterTask)}
            className="px-4 py-2 text-sm font-medium text-white bg-[--color-primary] rounded-lg hover:bg-[--color-primary-dark] transition-colors"
          >
            <Save size={16} className="inline mr-1" />
            Save Changes
          </button>
        </div>
      </div>
    );
  };

  const renderMasterTaskCardView = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      {(currentItems as MasterTask[]).map((masterTask: MasterTask) => (
        <div key={masterTask.taskGroupId} className="space-y-4">
          {renderMasterTaskEditForm(masterTask)}
          
          <div className="bg-[--color-background] rounded-xl shadow-sm border border-[--color-border] hover:shadow-md transition-all duration-200 overflow-hidden">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-semibold text-[--color-text] line-clamp-2">
                  {masterTask.title}
                </h3>
                {hasMasterTaskActions && (
                  <div className="flex items-center space-x-2 ml-2">
                    {canEditRecurringTaskSchedules && (
                      <button
                        onClick={() => handleEditMasterTask(masterTask)}
                        className="p-2 text-[--color-primary] hover:bg-[--color-primary-light] hover:text-white rounded-lg transition-colors"
                        title="Edit master task"
                      >
                        <Edit3 size={16} />
                      </button>
                    )}
                    {canDeleteTasks && (
                      <button
                        onClick={() => handleDeleteMasterTask(masterTask)}
                        className="p-2 text-[--color-error] hover:bg-[--color-error-light] hover:text-white rounded-lg transition-colors"
                        title="Delete master task"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                <TaskTypeBadge taskType={masterTask.taskType} />
                <PriorityBadge priority={masterTask.priority} />
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-[--color-info-light] text-[--color-info]">
                  {masterTask.instanceCount} instances
                </span>
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-[--color-success-light] text-[--color-success]">
                  {masterTask.completedCount} completed
                </span>
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-[--color-warning-light] text-[--color-warning]">
                  {masterTask.pendingCount} pending
                </span>
                {masterTask.parentTaskInfo?.isForever && (
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-[--color-primary-light] text-[--color-primary]">
                    FOREVER
                  </span>
                )}
              </div>

              <ReadMore text={masterTask.description} maxLength={descriptionMaxLength} />

              <div className="space-y-2 text-sm text-[--color-textSecondary]">
                <div className="flex justify-between">
                  <span>Assigned by:</span>
                  <span className="font-medium">{masterTask.assignedBy.username}</span>
                </div>
                {isAdmin && (
                  <div className="flex justify-between">
                    <span>Assigned to:</span>
                    <span className="font-medium">{masterTask.assignedTo.username}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="flex items-center">
                    <Paperclip size={14} className="mr-1" />
                    Attachments:
                  </span>
                  {masterTask.attachments && masterTask.attachments.length > 0 ? (
                    <button
                      onClick={() => setShowAttachmentsModal(masterTask.attachments)}
                      className="font-medium text-[--color-primary] hover:text-[--color-primary-dark]"
                    >
                      Click Here ({masterTask.attachments.length})
                    </button>
                  ) : (
                    <span>No Attachments</span>
                  )}
                </div>
                <div className="flex justify-between">
                  <span>Date range:</span>
                  <span className="font-medium">
                    {new Date(masterTask.tasks[0].dueDate).toLocaleDateString()} - {new Date(masterTask.tasks[masterTask.tasks.length - 1].dueDate).toLocaleDateString()}
                  </span>
                </div>
                {masterTask.parentTaskInfo && (
                  <div className="flex justify-between">
                    <span>Include Sunday:</span>
                    <span className="font-medium">{masterTask.parentTaskInfo.includeSunday ? 'Yes' : 'No'}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderMasterTaskTableView = () => (
    <div className="bg-[--color-background] rounded-xl shadow-sm border border-[--color-border] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[--color-border]">
          <thead className="bg-[--color-surface]">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-[--color-textSecondary] uppercase tracking-wider">
                Master Task
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[--color-textSecondary] uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[--color-textSecondary] uppercase tracking-wider">
                Priority
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[--color-textSecondary] uppercase tracking-wider">
                Instances
              </th>
              {isAdmin && (
                <th className="px-6 py-3 text-left text-xs font-medium text-[--color-textSecondary] uppercase tracking-wider">
                  Assigned To
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-[--color-textSecondary] uppercase tracking-wider">
                Date Range
              </th>
              {hasMasterTaskActions && (
                <th className="px-6 py-3 text-left text-xs font-medium text-[--color-textSecondary] uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-[--color-background] divide-y divide-[--color-border]">
            {(currentItems as MasterTask[]).map((masterTask: MasterTask) => (
              <React.Fragment key={masterTask.taskGroupId}>
                <tr className="hover:bg-[--color-surface] transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-[--color-text] mb-1">
                        {masterTask.title}
                      </div>
                      <ReadMore text={masterTask.description} maxLength={descriptionMaxLength} />
                      <div className="flex items-center mt-2 space-x-2">
                        {masterTask.parentTaskInfo?.isForever && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-[--color-primary-light] text-[--color-primary]">
                            FOREVER
                          </span>
                        )}
                        {masterTask.parentTaskInfo && (
                          <span className="text-xs text-[--color-textSecondary]">
                            Sunday: {masterTask.parentTaskInfo.includeSunday ? 'Yes' : 'No'}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <TaskTypeBadge taskType={masterTask.taskType} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <PriorityBadge priority={masterTask.priority} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-[--color-text]">
                      Total: {masterTask.instanceCount}
                    </div>
                    <div className="text-xs text-[--color-success]">
                      Completed: {masterTask.completedCount}
                    </div>
                    <div className="text-xs text-[--color-warning]">
                      Pending: {masterTask.pendingCount}
                    </div>
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-[--color-text]">{masterTask.assignedTo.username}</div>
                      <div className="text-sm text-[--color-textSecondary]">{masterTask.assignedTo.email}</div>
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-[--color-text]">
                      {new Date(masterTask.tasks[0].dueDate).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-[--color-textSecondary]">
                      to {new Date(masterTask.tasks[masterTask.tasks.length - 1].dueDate).toLocaleDateString()}
                    </div>
                  </td>
                  {hasMasterTaskActions && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        {canEditRecurringTaskSchedules && (
                          <button
                            onClick={() => handleEditMasterTask(masterTask)}
                            className="p-2 text-[--color-primary] hover:bg-[--color-primary] hover:text-white rounded-lg transition-colors"
                            title="Edit master task"
                          >
                            <Edit3 size={16} />
                          </button>
                        )}
                        {canDeleteTasks && (
                          <button
                            onClick={() => handleDeleteMasterTask(masterTask)}
                            className="p-2 text-[--color-error] hover:bg-[--color-error] hover:text-white rounded-lg transition-colors"
                            title="Delete master task"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
                {editingMasterTask === masterTask.taskGroupId && (
                  <tr>
                    <td colSpan={isAdmin ? (hasMasterTaskActions ? 7 : 6) : (hasMasterTaskActions ? 6 : 5)} className="px-6 py-4">
                      {renderMasterTaskEditForm(masterTask)}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderCardView = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
      {(currentItems as Task[]).map((task: Task) => (
        <div
          key={task._id}
          className="bg-[--color-background] rounded-xl shadow-sm border border-[--color-border] hover:shadow-md transition-all duration-200 overflow-hidden"
        >
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-lg font-semibold text-[--color-text] line-clamp-2">
                {task.title}
              </h3>
              {canDeleteTasks && (
                <button
                  onClick={() => handleDeleteTask(task._id)}
                  className="p-2 text-[--color-error] hover:bg-[--color-error-light] hover:text-white rounded-lg transition-colors ml-2"
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
              {canDeleteTasks && (
                <th className="px-6 py-3 text-left text-xs font-medium text-[--color-textSecondary] uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-[--color-background] divide-y divide-[--color-border]">
            {(currentItems as Task[]).map((task: Task) => (
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
                {canDeleteTasks && (
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleDeleteTask(task._id)}
                      className="p-2 text-[--color-error] hover:bg-[--color-error-light] hover:text-white rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                )}
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
            {isEditMode ? `${masterTasks.length} master task series` : `${filteredTasks.length} of ${allTasks.length} recurring task(s) found`}
            {isAdmin ? ' (All team members)' : ' (Your tasks)'} 
          </p>
        </div>
        <div className="flex items-center mt-4 sm:mt-0 space-x-3">
          {canEditRecurringTaskSchedules && (
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors flex items-center ${
                isEditMode 
                  ? 'bg-[--color-primary] text-white hover:bg-[--color-primary]' 
                  : 'text-[--color-text] bg-[--color-surface] hover:bg-[--color-border]'
              }`}
            >
              <Edit3 size={16} className="inline mr-2" />
              {isEditMode ? 'Exit Edit Mode' : 'Edit Master Tasks'}
            </button>
          )}
          {!isEditMode && (
            <>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-2 text-sm font-medium text-[--color-textSecondary] bg-[--color-surface] hover:bg-[--color-border] rounded-lg transition-colors flex items-center"
                title={showFilters ? "Hide Filters" : "Show Filters"}
              >
                <Filter size={16} className="inline mr-2" />
                {showFilters ? "Hide Filters" : "Show Filters"}
              </button>
              <ViewToggle view={view} onViewChange={setView} />
            </>
          )}
        </div>
      </div>

      {/* Filters - Only show when not in edit mode */}
      {!isEditMode && showFilters && (
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
                <option value="quarterly">Quarterly</option>
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
      {currentData.length === 0 ? (
        <div className="text-center py-12">
          <RotateCcw size={48} className="mx-auto mb-4 text-[--color-textSecondary]" />
          <p className="text-lg text-[--color-textSecondary]">
            {isEditMode 
              ? 'No master tasks found'
              : Object.values(filter).some(value => value !== '') 
                ? 'No recurring tasks match your filters'
                : 'No recurring tasks found'}
          </p>
          {!isEditMode && Object.values(filter).some(value => value !== '') && (
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
          {isEditMode 
            ? (view === 'card' ? renderMasterTaskCardView() : renderMasterTaskTableView())
            : (view === 'card' ? renderCardView() : renderTableView())
          }

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
                    <span className="font-medium">{Math.min(endIndex, currentData.length)}</span> of{' '}
                    <span className="font-medium">{currentData.length}</span> results
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