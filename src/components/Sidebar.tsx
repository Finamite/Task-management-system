import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  CheckSquare,
  RefreshCw,
  Archive,
  RotateCcw,
  UserPlus,
  Settings,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

// Clean and Professional Finamite Logo Component
const FinamiteLogo = ({ isCollapsed }) => (
  <div className="flex items-center">
    <div className="relative mr-3">
      {/* Simple, clean icon container */}
      <div 
        className="w-8 h-9 rounded-lg flex items-center justify-center relative"
        style={{
          backgroundColor: '#2563eb',
          boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)'
        }}
      >
        {/* Clean 'F' letter */}
        <div 
          className="text-white font-bold text-xl leading-none select-none"
          style={{ 
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: '700'
          }}
        >
          F
        </div>
      </div>
    </div>
    {!isCollapsed && (
      <span 
        className="text-xl font-bold tracking-tight transition-opacity duration-200"
        style={{ 
          color: '#277ef8ff',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        Finamite
      </span>
    )}
  </div>
);

// Tooltip Component
const Tooltip = ({ children, content, show }) => (
  <div className="relative group">
    {children}
    {show && (
      <div className="absolute left-full ml-2 top-1/2 transform -translate-y-1/2 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
        <div 
          className="px-3 py-2 text-sm rounded-lg shadow-lg whitespace-nowrap"
          style={{ 
            backgroundColor: 'var(--color-text)', 
            color: 'var(--color-background)' 
          }}
        >
          {content}
          <div 
            className="absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-1"
            style={{
              width: 0,
              height: 0,
              borderTop: '4px solid transparent',
              borderBottom: '4px solid transparent',
              borderRight: '4px solid var(--color-text)'
            }}
          />
        </div>
      </div>
    )}
  </div>
);

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(true); // Default collapsed state
  
  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: CheckSquare, label: 'Pending Tasks', path: '/pending-tasks' },
    { icon: RefreshCw, label: 'Pending Recurring', path: '/pending-recurring' },
    { icon: Archive, label: 'Master Tasks', path: '/master-tasks' },
    { icon: RotateCcw, label: 'Master Recurring', path: '/master-recurring' },
    { icon: UserPlus, label: 'Assign Task', path: '/assign-task', permission: 'canAssignTasks' },
    { icon: Settings, label: 'Admin Panel', path: '/admin', requireAdmin: true }
  ];

  const filteredMenuItems = menuItems.filter(item => {
    if (item.requireAdmin && user?.role !== 'admin') return false;
    if (item.permission && !user?.permissions[item.permission as keyof typeof user.permissions]) return false;
    return true;
  });

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 transition-opacity bg-black opacity-50 lg:hidden"
          onClick={onClose}
        ></div>
      )}



      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-30 overflow-y-auto transition-all duration-300 transform lg:translate-x-0 lg:static lg:inset-0 ${
          isOpen ? 'translate-x-0 ease-out' : '-translate-x-full ease-in lg:translate-x-0'
        } border-r shadow-sm`}
        style={{ 
          backgroundColor: 'var(--color-surface)', 
          borderColor: 'var(--color-border)',
          width: isCollapsed ? '5rem' : '12rem'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between flex-shrink-0 p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <FinamiteLogo isCollapsed={isCollapsed} />
          
          {/* Desktop toggle button */}
          <button
            onClick={toggleCollapse}
            className="hidden lg:flex p-1 rounded-md hover:bg-opacity-10 transition-colors duration-200"
            style={{ color: 'var(--color-text)' }}
          >
            {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
          
          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="p-1 rounded-md lg:hidden hover:bg-opacity-10"
            style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-background)' }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="mt-4">
          <div className="px-2 space-y-2">
            {filteredMenuItems.map((item) => (
              <Tooltip 
                key={item.path} 
                content={item.label} 
                show={isCollapsed}
              >
                <NavLink
                  to={item.path}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center px-2 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                      isActive
                        ? 'text-white'
                        : ''
                    } ${isCollapsed ? 'justify-center' : ''}`
                  }
                  style={({ isActive }) => ({
                    background: isActive 
                      ? 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' 
                      : 'transparent',
                    color: isActive ? 'white' : 'var(--color-text)',
                    ':hover': !isActive ? {
                      backgroundColor: 'var(--color-surface)',
                      transform: 'translateX(2px)'
                    } : {}
                  })}
                  onMouseEnter={(e) => {
                    if (!e.currentTarget.classList.contains('text-white')) {
                      e.currentTarget.style.backgroundColor = 'rgba(0, 112, 243, 0.05)';
                      e.currentTarget.style.transform = 'translateX(2px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!e.currentTarget.classList.contains('text-white')) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.transform = 'translateX(0)';
                    }
                  }}
                >
                  <item.icon size={16} className={isCollapsed ? '' : 'mr-3'} />
                  {!isCollapsed && (
                    <span className="transition-opacity duration-200">
                      {item.label}
                    </span>
                  )}
                </NavLink>
              </Tooltip>
            ))}
          </div>
        </nav>

        {/* User Profile */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          {isCollapsed ? (
            <Tooltip content={`${user?.username} (${user?.role})`} show={true}>
              <div className="flex justify-center">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium" style={{ backgroundColor: 'var(--color-primary)' }}>
                  {user?.username?.charAt(0).toUpperCase()}
                </div>
              </div>
            </Tooltip>
          ) : (
            <div className="flex items-center transition-opacity duration-200">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium" style={{ backgroundColor: 'var(--color-primary)' }}>
                {user?.username?.charAt(0).toUpperCase()}
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium" style={{ color: 'var(--color-text)' }}>
                  {user?.username}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-textSecondary)' }}>
                  {user?.role}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Sidebar;