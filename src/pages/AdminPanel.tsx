import React, { useState, useEffect } from 'react';
import { Settings, Users, Plus, Edit, Trash2, Save, X } from 'lucide-react';
import axios from 'axios';

interface User {
  _id: string;
  username: string;
  email: string;
  role: string;
  permissions: {
    canViewTasks: boolean;
    canViewAllTeamTasks: boolean;
    canAssignTasks: boolean;
    canDeleteTasks: boolean;
    canEditTasks: boolean;
    canManageUsers: boolean;
  };
  isActive: boolean;
  createdAt: string;
}

const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'employee',
    permissions: {
      canViewTasks: true,
      canViewAllTeamTasks: false,
      canAssignTasks: false,
      canDeleteTasks: false,
      canEditTasks: false,
      canManageUsers: false
    }
  });
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (name.startsWith('permissions.')) {
      const permissionKey = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        permissions: {
          ...prev.permissions,
          [permissionKey]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
      }));
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/users', formData);
      setMessage({ type: 'success', text: 'User created successfully!' });
      setShowCreateModal(false);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to create user' });
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      await axios.put(`http://localhost:5000/api/users/${editingUser._id}`, {
        username: formData.username,
        email: formData.email,
        role: formData.role,
        permissions: formData.permissions
      });
      setMessage({ type: 'success', text: 'User updated successfully!' });
      setEditingUser(null);
      resetForm();
      fetchUsers();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to update user' });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await axios.delete(`http://localhost:5000/api/users/${userId}`);
        setMessage({ type: 'success', text: 'User deleted successfully!' });
        fetchUsers();
      } catch (error: any) {
        setMessage({ type: 'error', text: error.response?.data?.message || 'Failed to delete user' });
      }
    }
  };

  const startEditUser = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      password: '',
      role: user.role,
      permissions: user.permissions
    });
  };

  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      password: '',
      role: 'employee',
      permissions: {
        canViewTasks: true,
        canViewAllTeamTasks: false,
        canAssignTasks: false,
        canDeleteTasks: false,
        canEditTasks: false,
        canManageUsers: false
      }
    });
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'var(--color-error)';
      case 'manager': return 'var(--color-warning)';
      case 'employee': return 'var(--color-success)';
      default: return 'var(--color-textSecondary)';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: 'var(--color-primary)' }}></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Settings size={20} style={{ color: 'var(--color-primary)' }} />
          <h1 className="text-xl font-bold" style={{ color: 'var(--color-text)' }}>
            Admin Panel
          </h1>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-2 py-1 rounded-lg text-white font-medium hover:opacity-90 transition-opacity"
          style={{ backgroundColor: 'var(--color-primary)' }}
        >
          <Plus size={16} className="inline mr-2" />
          Create User
        </button>
      </div>

      {message.text && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Users Table */}
      <div className="rounded-lg border overflow-hidden" style={{ backgroundColor: 'var(--color-background)', borderColor: 'var(--color-border)' }}>
        <div className="p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-md font-semibold flex items-center" style={{ color: 'var(--color-text)' }}>
            <Users className="mr-2" size={16} />
            User Management
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b" style={{ backgroundColor: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
              <tr>
                <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--color-text)' }}>User</th>
                <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--color-text)' }}>Role</th>
                <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--color-text)' }}>Permissions</th>
                <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--color-text)' }}>Status</th>
                <th className="text-left py-3 px-4 font-medium" style={{ color: 'var(--color-text)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id} className="border-b hover:bg-opacity-50" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium" style={{ color: 'var(--color-text)' }}>{user.username}</p>
                      <p className="text-sm" style={{ color: 'var(--color-textSecondary)' }}>{user.email}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className="px-2 py-1 text-xs font-medium rounded-full capitalize"
                      style={{
                        backgroundColor: `${getRoleColor(user.role)}20`,
                        color: getRoleColor(user.role)
                      }}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-xs space-y-1">
                      {Object.entries(user.permissions).map(([key, value]) => (
                        value && (
                          <div key={key} className="inline-block mr-2 mb-1">
                            <span
                              className="px-2 py-1 rounded-full"
                              style={{
                                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                                color: 'var(--color-primary)'
                              }}
                            >
                              {key.replace('can', '').replace(/([A-Z])/g, ' $1').trim()}
                            </span>
                          </div>
                        )
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => startEditUser(user)}
                        className="p-1 rounded hover:bg-opacity-10"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        <Edit size={16} />
                      </button>
                      {user.role !== 'admin' && (
                        <button
                          onClick={() => handleDeleteUser(user._id)}
                          className="p-1 rounded hover:bg-opacity-10"
                          style={{ color: 'var(--color-error)' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="p-6 rounded-lg max-w-2xl w-full mx-4 max-h-102 overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                Create New User
              </h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                    Username *
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border rounded-lg"
                    style={{
                      backgroundColor: 'var(--color-background)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text)'
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                    Email *
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border rounded-lg"
                    style={{
                      backgroundColor: 'var(--color-background)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text)'
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                    Password *
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    required
                    className="w-full px-3 py-2 border rounded-lg"
                    style={{
                      backgroundColor: 'var(--color-background)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text)'
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                    Role
                  </label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border rounded-lg"
                    style={{
                      backgroundColor: 'var(--color-background)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text)'
                    }}
                  >
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
                  Permissions
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(formData.permissions).map(([key, value]) => (
                    <label key={key} className="flex items-center">
                      <input
                        type="checkbox"
                        name={`permissions.${key}`}
                        checked={value}
                        onChange={handleInputChange}
                        className="mr-2"
                      />
                      <span className="text-sm" style={{ color: 'var(--color-text)' }}>
                        {key.replace('can', '').replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 rounded-lg text-white font-medium"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  <Save size={16} className="inline mr-2" />
                  Create User
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetForm();
                  }}
                  className="flex-1 py-2 px-4 rounded-lg border font-medium"
                  style={{
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-text)'
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        // <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        //   <div className="p-6 rounded-lg max-w-2xl w-full mx-4 max-h-96 overflow-y-auto" style={{ backgroundColor: 'var(--color-surface)' }}>
        //     <div className="flex items-center justify-between mb-4">
        //       <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
        //         Edit User - {editingUser.username}
        //       </h3>
        //       <button
        //         onClick={() => {
        //           setEditingUser(null);
        //           resetForm();
        //         }}
        //         className="text-gray-500 hover:text-gray-700"
        //       >
        //         <X size={20} />
        //       </button>
        //     </div>

        //     <form onSubmit={handleUpdateUser} className="space-y-4">
        //       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        //         <div>
        //           <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
        //             Username *
        //           </label>
        //           <input
        //             type="text"
        //             name="username"
        //             value={formData.username}
        //             onChange={handleInputChange}
        //             required
        //             className="w-full px-3 py-2 border rounded-lg"
        //             style={{
        //               backgroundColor: 'var(--color-background)',
        //               borderColor: 'var(--color-border)',
        //               color: 'var(--color-text)'
        //             }}
        //           />
        //         </div>

        //         <div>
        //           <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
        //             Email *
        //           </label>
        //           <input
        //             type="email"
        //             name="email"
        //             value={formData.email}
        //             onChange={handleInputChange}
        //             required
        //             className="w-full px-3 py-2 border rounded-lg"
        //             style={{
        //               backgroundColor: 'var(--color-background)',
        //               borderColor: 'var(--color-border)',
        //               color: 'var(--color-text)'
        //             }}
        //           />
        //         </div>

        //         <div className="md:col-span-2">
        //           <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
        //             Role
        //           </label>
        //           <select
        //             name="role"
        //             value={formData.role}
        //             onChange={handleInputChange}
        //             className="w-full px-3 py-2 border rounded-lg"
        //             style={{
        //               backgroundColor: 'var(--color-background)',
        //               borderColor: 'var(--color-border)',
        //               color: 'var(--color-text)'
        //             }}
        //           >
        //             <option value="employee">Employee</option>
        //             <option value="manager">Manager</option>
        //             <option value="admin">Admin</option>
        //           </select>
        //         </div>
        //       </div>

        //       <div>
        //         <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text)' }}>
        //           Permissions
        //         </label>
        //         <div className="grid grid-cols-2 gap-2">
        //           {Object.entries(formData.permissions).map(([key, value]) => (
        //             <label key={key} className="flex items-center">
        //               <input
        //                 type="checkbox"
        //                 name={`permissions.${key}`}
        //                 checked={value}
        //                 onChange={handleInputChange}
        //                 className="mr-2"
        //               />
        //               <span className="text-sm" style={{ color: 'var(--color-text)' }}>
        //                 {key.replace('can', '').replace(/([A-Z])/g, ' $1').trim()}
        //               </span>
        //             </label>
        //           ))}
        //         </div>
        //       </div>

        //       <div className="flex space-x-3 pt-4">
        //         <button
        //           type="submit"
        //           className="flex-1 py-2 px-4 rounded-lg text-white font-medium"
        //           style={{ backgroundColor: 'var(--color-primary)' }}
        //         >
        //           <Save size={16} className="inline mr-2" />
        //           Update User
        //         </button>
        //         <button
        //           type="button"
        //           onClick={() => {
        //             setEditingUser(null);
        //             resetForm();
        //           }}
        //           className="flex-1 py-2 px-4 rounded-lg border font-medium"
        //           style={{
        //             borderColor: 'var(--color-border)',
        //             color: 'var(--color-text)'
        //           }}
        //         >
        //           Cancel
        //         </button>
        //       </div>
        //     </form>
        //   </div>
        // </div>
      )}
    </div>
  );
};

export default AdminPanel;