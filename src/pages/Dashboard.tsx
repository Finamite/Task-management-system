import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import {
  CheckSquare, Clock, AlertTriangle, TrendingUp, Calendar,
  Target, Activity, CheckCircle, XCircle, Timer,
  ChevronDown, Award, Star, Zap, ArrowUp, ArrowDown, BarChart3,
  PieChart as PieChartIcon, Trophy,
  Clock4, CalendarDays, RefreshCw, UserCheck, TrendingUpIcon,
  PercentIcon, ClockIcon, User, Users, Filter
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { format, startOfMonth, endOfMonth, subMonths, addMonths, isThisMonth, isSameMonth, isSameYear } from 'date-fns';
import { availableThemes } from '../contexts/ThemeContext';

// --- Interfaces (kept as is, no changes needed based on requirements) ---
interface DashboardData {
  statusStats: Array<{ _id: string; count: number }>;
  typeStats: Array<{ _id: string; count: number }>;
  priorityStats: Array<{ _id: string; count: number }>;
  completionTrend: Array<{ _id: { month: number; year: number }; count: number }>;
  plannedTrend: Array<{ _id: { month: number; year: number }; count: number }>;
  teamPerformance: Array<{
    username: string;
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    oneTimeTasks: number;
    oneTimePending: number;
    oneTimeCompleted: number;
    dailyTasks: number;
    dailyPending: number;
    dailyCompleted: number;
    weeklyTasks: number;
    weeklyPending: number;
    weeklyCompleted: number;
    monthlyTasks: number;
    monthlyPending: number;
    monthlyCompleted: number;
    yearlyTasks: number;
    yearlyPending: number;
    yearlyCompleted: number;
    recurringTasks: number;
    recurringPending: number;
    recurringCompleted: number;
    completionRate: number;
    onTimeRate: number;
    onTimeCompletedTasks: number;
    onTimeRecurringCompleted: number;
  }>;
  recentActivity: Array<{
    _id: string;
    title: string;
    type: 'assigned' | 'completed' | 'overdue';
    username: string;
    assignedBy?: string;
    date: string;
    taskType: string;
  }>;
  performanceMetrics: {
    onTimeCompletion: number;
    averageCompletionTime: number;
    taskDistribution: Array<{ type: string; count: number; percentage: number }>;
    oneTimeOnTimeRate?: number;
    recurringOnTimeRate?: number;
  };
  userPerformance?: {
    username: string;
    totalTasks: number;
    completedTasks: number;
    pendingTasks: number;
    oneTimeTasks: number;
    oneTimePending: number;
    oneTimeCompleted: number;
    dailyTasks: number;
    dailyPending: number;
    dailyCompleted: number;
    weeklyTasks: number;
    weeklyPending: number;
    weeklyCompleted: number;
    monthlyTasks: number;
    monthlyPending: number;
    monthlyCompleted: number;
    yearlyTasks: number;
    yearlyPending: number;
    yearlyCompleted: number;
    recurringTasks: number;
    recurringPending: number;
    recurringCompleted: number;
    completionRate: number;
    onTimeRate: number;
    onTimeCompletedTasks: number;
    onTimeRecurringCompleted: number;
  };
}

interface TaskCounts {
  totalTasks: number;
  pendingTasks: number;
  completedTasks: number;
  overdueTasks: number;
  oneTimeTasks: number;
  oneTimePending: number;
  oneTimeCompleted: number;
  recurringTasks: number;
  recurringPending: number;
  recurringCompleted: number;
  dailyTasks: number;
  dailyPending: number;
  dailyCompleted: number;
  weeklyTasks: number;
  weeklyPending: number;
  weeklyCompleted: number;
  monthlyTasks: number;
  monthlyPending: number;
  monthlyCompleted: number;
  yearlyTasks: number;
  yearlyPending: number;
  yearlyCompleted: number;
  trends?: {
    totalTasks: { value: number; direction: 'up' | 'down' };
    pendingTasks: { value: number; direction: 'up' | 'down' };
    completedTasks: { value: number; direction: 'up' | 'down' };
    overdueTasks: { value: number; direction: 'up' | 'down' };
  };
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { theme, setTheme, isDark } = useTheme();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [taskCounts, setTaskCounts] = useState<TaskCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showMonthFilter, setShowMonthFilter] = useState(false);
  const [viewMode, setViewMode] = useState<'current' | 'all-time'>('current');
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  
  // New states for team member selection
  const [selectedTeamMember, setSelectedTeamMember] = useState<string>('all');
  const [showTeamMemberFilter, setShowTeamMemberFilter] = useState(false);
  const [memberTrendData, setMemberTrendData] = useState<any[]>([]);

  // --- ThemeCard Component (kept as is, good utility component) ---
  const ThemeCard = ({ children, className = "", variant = "default", hover = true }: {
    children: React.ReactNode;
    className?: string;
    variant?: 'default' | 'glass' | 'elevated' | 'bordered';
    hover?: boolean;
  }) => {
    const baseClasses = "relative overflow-hidden transition-all duration-300 ease-out";

    const variants = {
      default: `rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-lg`,
      glass: `rounded-2xl bg-[var(--color-surface)]/80 backdrop-blur-xl border border-[var(--color-border)]/50 shadow-xl`,
      elevated: `rounded-2xl bg-[var(--color-surface)] border border-[var(--color-border)] shadow-2xl`,
      bordered: `rounded-2xl bg-[var(--color-primary)]/10 border-2 border-[var(--color-primary)]/20`
    };

    const hoverClasses = hover ? "hover:shadow-xl hover:scale-[1.02] hover:border-[var(--color-primary)]/30" : "";

    return (
      <div className={`${baseClasses} ${variants[variant]} ${hoverClasses} ${className}`}>
        {children}
      </div>
    );
  };

  // --- MetricCard Component with Real Trends ---
  const MetricCard = ({
    icon,
    title,
    value,
    subtitle,
    trend,
    percentage,
    sparklineData,
    isMain = false,
    pendingValue,
    completedValue
  }: {
    icon: React.ReactNode;
    title: string;
    value: string | number;
    subtitle?: string;
    trend?: { value: number; direction: 'up' | 'down' };
    percentage?: number;
    sparklineData?: number[];
    isMain?: boolean;
    pendingValue?: number;
    completedValue?: number;
  }) => (
    <ThemeCard className={`p-4 ${isMain ? 'col-span-2' : ''}`} variant="glass">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center space-x-2">
          <div
            className="p-2 rounded-2xl shadow-lg ring-1 ring-white/20"
            style={{
              backgroundColor: `var(--color-primary)15`,
              boxShadow: `0 8px 25px var(--color-primary)25`
            }}
          >
            <div style={{ color: 'var(--color-primary)' }} className="w-4 h-4">
              {icon}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--color-textSecondary)] mb-1">
              {title}
            </p>
            <p className="text-xl font-bold text-[var(--color-text)]">
              {value}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end space-y-2">
          {trend && (
            <div className={`flex items-center px-2 py-1.5 rounded-full text-xs font-bold ${
              trend.direction === 'up'
                ? 'bg-[var(--color-success)]/10 text-[var(--color-success)]'
                : 'bg-[var(--color-error)]/10 text-[var(--color-error)]'
            }`}>
              {trend.direction === 'up' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
              <span className="ml-1">{trend.value}%</span>
            </div>
          )}

          {percentage !== undefined && (
            <div className="flex items-center space-x-2">
              <div className="w-10 h-2 bg-[var(--color-border)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${Math.min(percentage, 100)}%`,
                    backgroundColor: 'var(--color-primary)'
                  }}
                />
              </div>
              <span className="text-xs font-semibold text-[var(--color-textSecondary)]">
                {percentage.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {subtitle && (
        <p className="text-sm text-[var(--color-textSecondary)] mb-3">{subtitle}</p>
      )}

      {(pendingValue !== undefined || completedValue !== undefined) && (
        <div className="flex items-center justify-between text-sm text-[var(--color-textSecondary)] mt-2 pt-2 border-t border-[var(--color-border)]">
          {pendingValue !== undefined && (
            <div className="flex items-center">
              <Clock size={12} className="mr-1" style={{ color: 'var(--color-warning)' }} />
              <span>Pending: <span className="font-bold text-[var(--color-warning)]">{pendingValue}</span></span>
            </div>
          )}
          {completedValue !== undefined && (
            <div className="flex items-center">
              <CheckCircle size={12} className="mr-1" style={{ color: 'var(--color-success)' }} />
              <span>Completed: <span className="font-bold text-[var(--color-success)]">{completedValue}</span></span>
            </div>
          )}
        </div>
      )}

      {sparklineData && sparklineData.length > 0 && (
        <div className="mt-4 h-12">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparklineData.map((value, index) => ({ value, index }))}>
              <defs>
                <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--color-primary)"
                strokeWidth={2}
                fill={`url(#gradient-${title})`}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </ThemeCard>
  );

  // --- Enhanced User Performance Card Component ---
  const UserPerformanceCard = ({ userPerformance }: { userPerformance: DashboardData['userPerformance'] }) => {
    if (!userPerformance) return null;

    // Calculate rates safely
    const actualCompletionRate = userPerformance.totalTasks > 0 ? (userPerformance.completedTasks / userPerformance.totalTasks) * 100 : 0;
    const actualOnTimeRate = userPerformance.completedTasks > 0 ? (userPerformance.onTimeCompletedTasks / userPerformance.completedTasks) * 100 : 0;
    const mainCompletionRate = (actualCompletionRate * 0.5) + (actualOnTimeRate * 0.5);

    return (
      <ThemeCard className="p-8" variant="glass">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8 space-y-6 lg:space-y-0">
          <div className="flex items-center space-x-6">
            <div className="relative">
              <div
                className="w-20 h-20 rounded-3xl bg-gradient-to-r from-blue-400 to-purple-600 flex items-center justify-center text-white font-bold shadow-xl text-2xl"
              >
                {userPerformance.username.charAt(0).toUpperCase()}
              </div>
              <div className="absolute -top-3 -right-3 bg-white rounded-full p-2.5 shadow-lg">
                <User size={20} style={{ color: 'var(--color-primary)' }} />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-4 mb-3">
                <h4 className="font-bold text-2xl text-[var(--color-text)]">
                  Your Performance
                </h4>
                <span className="text-sm px-4 py-2 rounded-full font-bold bg-blue-50 text-blue-700">
                  {userPerformance.username}
                </span>
              </div>
              <p className="text-lg font-semibold text-[var(--color-textSecondary)]">
                {userPerformance.totalTasks} total tasks assigned
              </p>
            </div>
          </div>

          <div className="text-center lg:text-right">
            <div className="text-5xl font-bold text-[var(--color-success)] mb-3">
              {mainCompletionRate.toFixed(1)}%
            </div>
            <div className="w-32 h-4 bg-[var(--color-border)] rounded-full overflow-hidden mx-auto lg:mx-0 mb-2">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${Math.min(mainCompletionRate, 100)}%`,
                  background: `linear-gradient(to right, var(--color-success), var(--color-primary))`
                }}
              />
            </div>
            <p className="text-sm text-[var(--color-textSecondary)] font-medium">Overall Performance Score</p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { label: 'One-time', total: userPerformance.oneTimeTasks, pending: userPerformance.oneTimePending, completed: userPerformance.oneTimeCompleted, icon: <Target size={18} />, color: 'var(--color-primary)' },
            { label: 'Daily', total: userPerformance.dailyTasks, pending: userPerformance.dailyPending, completed: userPerformance.dailyCompleted, icon: <RefreshCw size={18} />, color: 'var(--color-success)' },
            { label: 'Weekly', total: userPerformance.weeklyTasks, pending: userPerformance.weeklyPending, completed: userPerformance.weeklyCompleted, icon: <Calendar size={18} />, color: 'var(--color-warning)' },
            { label: 'Monthly', total: userPerformance.monthlyTasks, pending: userPerformance.monthlyPending, completed: userPerformance.monthlyCompleted, icon: <CalendarDays size={18} />, color: 'var(--color-accent)' },
          ].map((item, index) => (
            <ThemeCard key={index} className="p-5" variant="default" hover={false}>
              <div className="flex items-center mb-3">
                <div style={{ color: item.color }} className="mr-3">{item.icon}</div>
                <span className="text-sm font-bold text-[var(--color-textSecondary)]">{item.label} Tasks</span>
              </div>
              <div className="text-center mb-4">
                <span className="text-3xl font-bold text-[var(--color-text)] block">{item.total}</span>
                <span className="text-sm text-[var(--color-textSecondary)] font-medium">Total Assigned</span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Clock size={14} className="mr-2" style={{ color: 'var(--color-warning)' }} />
                    <span className="text-sm text-[var(--color-textSecondary)] font-medium">Pending</span>
                  </div>
                  <span className="text-lg font-bold text-[var(--color-warning)]">{item.pending}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <CheckCircle size={14} className="mr-2" style={{ color: 'var(--color-success)' }} />
                    <span className="text-sm text-[var(--color-textSecondary)] font-medium">Completed</span>
                  </div>
                  <span className="text-lg font-bold text-[var(--color-success)]">{item.completed}</span>
                </div>
              </div>
            </ThemeCard>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-6 border-t border-[var(--color-border)]">
          <div className="flex items-center justify-center lg:justify-start">
            <CheckCircle size={18} style={{ color: 'var(--color-success)' }} className="mr-3" />
            <div>
              <span className="text-sm text-[var(--color-textSecondary)] block">Completion Rate</span>
              <span className="text-xl font-bold text-[var(--color-success)]">{actualCompletionRate.toFixed(1)}%</span>
            </div>
          </div>
          <div className="flex items-center justify-center lg:justify-start">
            <Clock4 size={18} style={{ color: 'var(--color-primary)' }} className="mr-3" />
            <div>
              <span className="text-sm text-[var(--color-textSecondary)] block">On-time Rate</span>
              <span className="text-xl font-bold text-[var(--color-primary)]">{actualOnTimeRate.toFixed(1)}%</span>
            </div>
          </div>
          <div className="flex items-center justify-center lg:justify-start">
            <RefreshCw size={18} style={{ color: 'var(--color-info)' }} className="mr-3" />
            <div>
              <span className="text-sm text-[var(--color-textSecondary)] block">Recurring Tasks</span>
              <span className="text-xl font-bold text-[var(--color-text)]">{userPerformance.recurringTasks}</span>
            </div>
          </div>
          <div className="flex items-center justify-center lg:justify-start">
            <Target size={18} style={{ color: 'var(--color-warning)' }} className="mr-3" />
            <div>
              <span className="text-sm text-[var(--color-textSecondary)] block">On-time Completed</span>
              <span className="text-xl font-bold text-[var(--color-text)]">{userPerformance.onTimeCompletedTasks}</span>
            </div>
          </div>
        </div>
      </ThemeCard>
    );
  };

  // --- TeamMemberCard Component (Updated) ---
  const TeamMemberCard = ({ member, rank }: {
    member: DashboardData['teamPerformance'][0];
    rank: number;
  }) => {
    const getRankBadge = (rank: number) => {
      const badges = {
        1: { icon: <Trophy size={16} />, gradient: 'from-yellow-400 to-yellow-600', bg: 'bg-yellow-50', text: 'text-yellow-700' },
        2: { icon: <Award size={16} />, gradient: 'from-gray-300 to-gray-500', bg: 'bg-gray-50', text: 'text-gray-700' },
        3: { icon: <Star size={16} />, gradient: 'from-amber-400 to-amber-600', bg: 'bg-amber-50', text: 'text-amber-700' },
      };
      return badges[rank as keyof typeof badges] || {
        icon: <UserCheck size={16} />,
        gradient: 'from-blue-400 to-blue-600',
        bg: 'bg-blue-50',
        text: 'text-blue-700'
      };
    };
    const badge = getRankBadge(rank);
    const actualCompletionRate = member.totalTasks > 0 ? (member.completedTasks / member.totalTasks) * 100 : 0;
    const totalOnTimeCompleted = member.onTimeCompletedTasks + (member.onTimeRecurringCompleted || 0);
    const actualOnTimeRate = member.completedTasks > 0 ? (totalOnTimeCompleted / member.completedTasks) * 100 : 0;
    const mainCompletionRate = (actualCompletionRate * 0.5) + (actualOnTimeRate * 0.5);

    return (
      <ThemeCard className="p-4 sm:p-6 mb-4" variant="glass" hover={false}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 space-y-3 sm:space-y-0">
          <div className="flex items-center space-x-3 sm:space-x-4">
            <div className="relative">
              <div
                className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-r ${badge.gradient} flex items-center justify-center text-white font-bold shadow-lg`}
              >
                {member.username.charAt(0).toUpperCase()}
              </div>
              <div className={`absolute -top-2 -right-2 ${badge.bg} rounded-full p-1.5 shadow-md`}>
                <div className={badge.text}>
                  {badge.icon}
                </div>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-1">
                <h4 className="font-bold text-base sm:text-lg text-[var(--color-text)]">
                  {member.username}
                </h4>
                <span className={`text-xs px-2 sm:px-3 py-1 rounded-full font-bold ${badge.bg} ${badge.text}`}>
                  #{rank}
                </span>
              </div>
              <p className="text-xs sm:text-sm font-semibold text-[var(--color-textSecondary)]">
                {member.totalTasks} tasks
              </p>
            </div>
          </div>

          <div className="text-center sm:text-right">
            <div className="text-2xl sm:text-3xl font-bold text-[var(--color-success)] mb-2">
              {mainCompletionRate.toFixed(1)}%
            </div>
            <div className="w-20 sm:w-24 h-2 sm:h-3 bg-[var(--color-border)] rounded-full overflow-hidden mx-auto sm:mx-0">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${Math.min(mainCompletionRate, 100)}%`,
                  background: `linear-gradient(to right, var(--color-success), var(--color-primary))`
                }}
              />
            </div>
            <p className="text-xs text-[var(--color-textSecondary)] mt-1">Main Completion Rate</p>
          </div>
        </div>

        <div className="pt-4 border-t border-[var(--color-border)]">
          <div className="hidden sm:grid sm:grid-cols-4 sm:gap-4">
            {[
              { label: 'One-time', total: member.oneTimeTasks, pending: member.oneTimePending, completed: member.oneTimeCompleted, icon: <Target size={14} />, color: 'var(--color-primary)' },
              { label: 'Daily', total: member.dailyTasks, pending: member.dailyPending, completed: member.dailyCompleted, icon: <RefreshCw size={14} />, color: 'var(--color-success)' },
              { label: 'Weekly', total: member.weeklyTasks, pending: member.weeklyPending, completed: member.weeklyCompleted, icon: <Calendar size={14} />, color: 'var(--color-warning)' },
              { label: 'Monthly', total: member.monthlyTasks, pending: member.monthlyPending, completed: member.monthlyCompleted, icon: <CalendarDays size={14} />, color: 'var(--color-accent)' },
            ].map((item, index) => (
              <ThemeCard key={index} className="py-2 px-3" variant="default" hover={false}>
                <div className="flex items-center mb-1">
                  <div style={{ color: item.color }} className="mr-1">{item.icon}</div>
                  <span className="text-xs font-medium text-[var(--color-textSecondary)]">{item.label} Tasks</span>
                </div>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="text-lg font-bold text-[var(--color-text)]">{item.total}</span>
                  <span className="text-xs text-[var(--color-textSecondary)]">Total</span>
                </div>
                <div className="flex justify-between text-xs text-[var(--color-textSecondary)]">
                  <div className="flex items-center">
                    <Clock size={10} className="mr-1" style={{ color: 'var(--color-warning)' }} />
                    <span>{item.pending} Pending</span>
                  </div>
                  <div className="flex items-center">
                    <CheckCircle size={10} className="mr-1" style={{ color: 'var(--color-success)' }} />
                    <span>{item.completed} Completed</span>
                  </div>
                </div>
              </ThemeCard>
            ))}
          </div>

          <div className="sm:hidden">
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'One-time', total: member.oneTimeTasks, pending: member.oneTimePending, completed: member.oneTimeCompleted, icon: <Target size={12} />, color: 'var(--color-primary)' },
                { label: 'Daily', total: member.dailyTasks, pending: member.dailyPending, completed: member.dailyCompleted, icon: <RefreshCw size={12} />, color: 'var(--color-success)' },
                { label: 'Weekly', total: member.weeklyTasks, pending: member.weeklyPending, completed: member.weeklyCompleted, icon: <Calendar size={12} />, color: 'var(--color-warning)' },
                { label: 'Monthly', total: member.monthlyTasks, pending: member.monthlyPending, completed: member.monthlyCompleted, icon: <CalendarDays size={12} />, color: 'var(--color-accent)' },
              ].map((item, index) => (
                <ThemeCard key={index} className="py-2 px-2" variant="default" hover={false}>
                  <div className="flex items-center justify-center mb-1">
                    <div style={{ color: item.color }} className="mr-1">{item.icon}</div>
                    <span className="text-xs font-medium text-[var(--color-textSecondary)] text-center">{item.label}</span>
                  </div>
                  <div className="text-center mb-1">
                    <span className="text-lg font-bold text-[var(--color-text)] block">{item.total}</span>
                    <span className="text-xs text-[var(--color-textSecondary)]">Total</span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-center text-xs">
                      <Clock size={8} className="mr-1" style={{ color: 'var(--color-warning)' }} />
                      <span className="text-[var(--color-textSecondary)]">{item.pending} Pending</span>
                    </div>
                    <div className="flex items-center justify-center text-xs">
                      <CheckCircle size={8} className="mr-1" style={{ color: 'var(--color-success)' }} />
                      <span className="text-[var(--color-textSecondary)]">{item.completed} Done</span>
                    </div>
                  </div>
                </ThemeCard>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mt-4 pt-4 border-t border-[var(--color-border)] space-y-3 sm:space-y-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4">
            <div className="flex items-center justify-center sm:justify-start mb-2 sm:mb-0">
              <CheckCircle size={14} style={{ color: 'var(--color-success)' }} className="mr-1" />
              <span className="text-xs text-[var(--color-textSecondary)]">
                Total: <span className="font-bold">{member.totalTasks}</span>
              </span>
            </div>
            <div className="flex items-center justify-center sm:justify-start mb-2 sm:mb-0">
              <RefreshCw size={14} style={{ color: 'var(--color-info)' }} className="mr-1" />
              <span className="text-xs text-[var(--color-textSecondary)]">
                Recurring: <span className="font-bold">{member.recurringTasks}</span>
              </span>
            </div>
            <div className="flex items-center justify-center sm:justify-start">
              <Clock4 size={14} style={{ color: 'var(--color-primary)' }} className="mr-1" />
              <span className="text-xs text-[var(--color-textSecondary)]">
                Done-on-time: <span className="font-bold">{totalOnTimeCompleted}</span>
              </span>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4">
            <div className="flex items-center justify-center sm:justify-end mb-2 sm:mb-0">
              <PercentIcon size={14} style={{ color: 'var(--color-success)' }} className="mr-1" />
              <span className="text-xs text-[var(--color-textSecondary)]">
                Completion: <span className="font-bold">{actualCompletionRate.toFixed(1)}%</span>
              </span>
            </div>
            <div className="flex items-center justify-center sm:justify-end">
              <ClockIcon size={14} style={{ color: 'var(--color-warning)' }} className="mr-1" />
              <span className="text-xs text-[var(--color-textSecondary)]">
                On-time Rate: <span className="font-bold">{actualOnTimeRate.toFixed(1)}%</span>
              </span>
            </div>
          </div>
        </div>
      </ThemeCard>
    );
  };

  // --- CustomTooltip Component (kept as is, good utility component) ---
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <ThemeCard className="p-3" variant="elevated" hover={false}>
          <p className="text-sm font-semibold text-[var(--color-text)] mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-xs" style={{ color: entry.color }}>
              {entry.name}: <span className="font-bold">{entry.value}</span>
            </p>
          ))}
        </ThemeCard>
      );
    }
    return null;
  };

  // --- Core Data Fetching Logic ---
  // Using useCallback for memoization of fetch functions
  const fetchDashboardAnalytics = useCallback(async (startDate?: string, endDate?: string) => {
    try {
      const params: any = {
        userId: user?.id,
        isAdmin: user?.role === 'admin' ? 'true' : 'false',
      };
      if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      }
      
      const response = await axios.get(`http://localhost:5000/api/dashboard/analytics`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching dashboard analytics:', error);
      return null;
    }
  }, [user]);

  const fetchTaskCounts = useCallback(async (startDate?: string, endDate?: string) => {
    try {
      const params: any = {
        userId: user?.id,
        isAdmin: user?.role === 'admin' ? 'true' : 'false'
      };
      if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      }
      
      const response = await axios.get(`http://localhost:5000/api/dashboard/counts`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching task counts:', error);
      return null;
    }
  }, [user]);

  // New function to fetch individual member trend data
  const fetchMemberTrendData = useCallback(async (memberUsername: string, startDate?: string, endDate?: string) => {
    try {
      const params: any = {
        memberUsername,
        isAdmin: 'true'
      };
      if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      }
      
      const response = await axios.get(`http://localhost:5000/api/dashboard/member-trend`, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching member trend data:', error);
      return null;
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        let analyticsData = null;
        let countsData = null;

        if (viewMode === 'current') {
          // For current month view, use date filters
          const monthStart = startOfMonth(selectedMonth);
          const monthEnd = endOfMonth(selectedMonth);
          analyticsData = await fetchDashboardAnalytics(monthStart.toISOString(), monthEnd.toISOString());
          countsData = await fetchTaskCounts(monthStart.toISOString(), monthEnd.toISOString());
        } else {
          // For all-time view, fetch without date filters
          analyticsData = await fetchDashboardAnalytics();
          countsData = await fetchTaskCounts();
        }

        setDashboardData(analyticsData);
        setTaskCounts(countsData);

      } catch (error) {
        console.error('Error in loadData:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) {
      loadData();
    }
  }, [user, selectedMonth, viewMode, fetchDashboardAnalytics, fetchTaskCounts]);

  // Load member trend data when selected team member changes
  useEffect(() => {
    const loadMemberTrendData = async () => {
      if (user?.role === 'admin' && selectedTeamMember && selectedTeamMember !== 'all') {
        try {
          let memberTrendDataResult = null;
          
          if (viewMode === 'current') {
            const monthStart = startOfMonth(selectedMonth);
            const monthEnd = endOfMonth(selectedMonth);
            memberTrendDataResult = await fetchMemberTrendData(selectedTeamMember, monthStart.toISOString(), monthEnd.toISOString());
          } else {
            memberTrendDataResult = await fetchMemberTrendData(selectedTeamMember);
          }
          
          if (memberTrendDataResult) {
            setMemberTrendData(memberTrendDataResult);
          }
        } catch (error) {
          console.error('Error loading member trend data:', error);
        }
      }
    };

    loadMemberTrendData();
  }, [selectedTeamMember, viewMode, selectedMonth, fetchMemberTrendData, user?.role]);

  // --- Helper Functions ---
  const generateMonthOptions = () => {
    const options = [];
    const currentDate = new Date();

    for (let i = 5; i >= 1; i--) {
      options.push(subMonths(currentDate, i));
    }
    options.push(currentDate);
    for (let i = 1; i <= 5; i++) {
      options.push(addMonths(currentDate, i));
    }

    return options;
  };

  const monthOptions = generateMonthOptions();

  const statusColors = {
    pending: 'var(--color-warning)',
    completed: 'var(--color-success)',
    overdue: 'var(--color-error)',
    'in-progress': 'var(--color-primary)'
  };

  const statusData = dashboardData?.statusStats.map(item => ({
    name: item._id.charAt(0).toUpperCase() + item._id.slice(1),
    value: item.count,
    color: statusColors[item._id as keyof typeof statusColors] || 'var(--color-secondary)'
  })) || [];

  // Generate trend data to always show last 6 months including current month
  const generateTrendData = () => {
    const trendMonths: { month: string; completed: number; planned: number; }[] = [];
    const currentDate = new Date();

    // If a specific team member is selected and we have their data, use it
    if (selectedTeamMember !== 'all' && memberTrendData && memberTrendData.length > 0) {
      return memberTrendData;
    }

    // Otherwise use the overall team data
    // Generate last 6 months including current month
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(currentDate, i);
      const monthName = format(date, 'MMM');
      const monthNum = date.getMonth() + 1;
      const yearNum = date.getFullYear();

      const matchingCompletedData = dashboardData?.completionTrend?.find(item =>
        item._id.month === monthNum && item._id.year === yearNum
      );

      const matchingPlannedData = dashboardData?.plannedTrend?.find(item =>
        item._id.month === monthNum && item._id.year === yearNum
      );

      trendMonths.push({
        month: monthName,
        completed: matchingCompletedData?.count || 0,
        planned: matchingPlannedData?.count || 0,
      });
    }

    return trendMonths;
  };

  const trendData = generateTrendData();

  const displayData = taskCounts;

  const taskTypeData = [
    {
      name: 'One-time',
      value: displayData?.oneTimeTasks || 0,
      pending: displayData?.oneTimePending || 0,
      completed: displayData?.oneTimeCompleted || 0,
      color: 'var(--color-primary)'
    },
    {
      name: 'Daily',
      value: displayData?.dailyTasks || 0,
      pending: displayData?.dailyPending || 0,
      completed: displayData?.dailyCompleted || 0,
      color: 'var(--color-success)'
    },
    {
      name: 'Weekly',
      value: displayData?.weeklyTasks || 0,
      pending: displayData?.weeklyPending || 0,
      completed: displayData?.weeklyCompleted || 0,
      color: 'var(--color-warning)'
    },
    {
      name: 'Monthly',
      value: displayData?.monthlyTasks || 0,
      pending: displayData?.monthlyPending || 0,
      completed: displayData?.monthlyCompleted || 0,
      color: 'var(--color-accent)'
    },
    {
      name: 'Yearly',
      value: displayData?.yearlyTasks || 0,
      pending: displayData?.yearlyPending || 0,
      completed: displayData?.yearlyCompleted || 0,
      color: 'var(--color-secondary)'
    }
  ];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'assigned': return <Target size={16} style={{ color: 'var(--color-primary)' }} />;
      case 'completed': return <CheckCircle size={16} style={{ color: 'var(--color-success)' }} />;
      case 'overdue': return <XCircle size={16} style={{ color: 'var(--color-error)' }} />;
      default: return <Activity size={16} style={{ color: 'var(--color-secondary)' }} />;
    }
  };

  // Get team members list for the dropdown
  const getTeamMembersList = () => {
    if (!dashboardData?.teamPerformance || user?.role !== 'admin') return [];
    
    return dashboardData.teamPerformance.map(member => ({
      username: member.username,
      totalTasks: member.totalTasks,
      completionRate: member.totalTasks > 0 ? (member.completedTasks / member.totalTasks) * 100 : 0
    }));
  };

  const teamMembersList = getTeamMembersList();

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-background)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)] mx-auto mb-4"></div>
          <p className="text-[var(--color-textSecondary)]">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-background)] p-4 space-y-8">
      {/* Professional Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-6 lg:space-y-0">
        <div className="flex items-center space-x-6">
          <div className="p-3 rounded-xl shadow-xl" style={{ background: `linear-gradient(135deg, var(--color-primary), var(--color-accent))` }}>
            <BarChart3 size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[var(--color-text)] mb-2">
              Analytics Dashboard
            </h1>
            <p className="text-xs text-[var(--color-textSecondary)]">
              Welcome back, <span className="font-bold text-[var(--color-text)]">{user?.username}</span>!
              {user?.role !== 'admin' ? ' Here\'s your performance overview' : ' Team performance overview'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* View Mode Toggle */}
          <ThemeCard className="p-1" variant="bordered" hover={false}>
            <div className="flex items-center">
              <button
                onClick={() => {
                  setViewMode('current');
                  setSelectedMonth(new Date());
                }}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  viewMode === 'current'
                    ? 'bg-[var(--color-primary)] text-white shadow-md'
                    : 'text-[var(--color-textSecondary)] hover:text-[var(--color-text)]'
                }`}
              >
                Current Month
              </button>
              <button
                onClick={() => setViewMode('all-time')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  viewMode === 'all-time'
                    ? 'bg-[var(--color-primary)] text-white shadow-md'
                    : 'text-[var(--color-textSecondary)] hover:text-[var(--color-text)]'
                }`}
              >
                All Time
              </button>
            </div>
          </ThemeCard>

          {/* Month Filter - Visible only in 'current' view mode */}
          {viewMode === 'current' && (
            <div className="relative z-10">
              <button
                onClick={() => setShowMonthFilter(!showMonthFilter)}
                className="flex items-center px-2 py-2 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-lg hover:shadow-xl transition-all duration-200 text-[var(--color-text)] font-md"
              >
                <Calendar size={16} className="mr-3" />
                <span>
                  {isSameMonth(selectedMonth, new Date()) && isSameYear(selectedMonth, new Date())
                    ? 'Current Month'
                    : format(selectedMonth, 'MMMM yyyy')}
                </span>
                <ChevronDown size={16} className="ml-3" />
              </button>
              {showMonthFilter && (
                <div className="absolute left-0 top-full mt-2 w-52 z-20">
                  <ThemeCard className="p-3 max-h-80 overflow-y-auto" variant="elevated" hover={false}>
                    <div className="space-y-2">
                      {monthOptions.map((date, index) => {
                        const isSelected = format(date, 'yyyy-MM') === format(selectedMonth, 'yyyy-MM');
                        const isCurrent = isThisMonth(date);
                        return (
                          <button
                            key={index}
                            onClick={() => {
                              setSelectedMonth(date);
                              setShowMonthFilter(false);
                            }}
                            className={`w-full text-left px-2 py-3 rounded-xl transition-all duration-200 ${
                              isSelected
                                ? 'bg-[var(--color-primary)] text-white shadow-lg'
                                : 'hover:bg-[var(--color-border)] text-[var(--color-text)]'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">{format(date, 'MMMM yyyy')}</span>
                              <div className="flex items-center space-x-0">
                                {isCurrent && (
                                  <div className="w-2 h-2 bg-[var(--color-success)] rounded-full"></div>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </ThemeCard>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Metrics Grid with Real Trends */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          icon={<CheckSquare size={20} />}
          title="Total Tasks"
          value={displayData?.totalTasks || 0}
          subtitle={viewMode === 'current' && isSameMonth(selectedMonth, new Date()) && isSameYear(selectedMonth, new Date()) ? 'Current Month' : (viewMode === 'current' ? format(selectedMonth, 'MMMM yyyy') : 'All time')}
          trend={displayData?.trends?.totalTasks}
          percentage={100}
        />
        <MetricCard
          icon={<Clock size={20} />}
          title="Pending"
          value={displayData?.pendingTasks || 0}
          subtitle="Awaiting completion"
          trend={displayData?.trends?.pendingTasks}
          percentage={((displayData?.pendingTasks || 0) / (displayData?.totalTasks || 1)) * 100}
        />
        <MetricCard
          icon={<CheckCircle size={20} />}
          title="Completed"
          value={displayData?.completedTasks || 0}
          subtitle="Successfully finished"
          trend={displayData?.trends?.completedTasks}
          percentage={((displayData?.completedTasks || 0) / (displayData?.totalTasks || 1)) * 100}
        />
        <MetricCard
          icon={<AlertTriangle size={20} />}
          title="Overdue"
          value={displayData?.overdueTasks || 0}
          subtitle="Needs attention"
          trend={displayData?.trends?.overdueTasks}
          percentage={((displayData?.overdueTasks || 0) / (displayData?.totalTasks || 1)) * 100}
        />
      </div>

      {/* Task Type Distribution - Now includes pending and completed sub-counts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {taskTypeData.map((type, index) => (
          <MetricCard
            key={type.name}
            icon={
              type.name === 'One-time' ? <Target size={18} /> :
              type.name === 'Daily' ? <Zap size={18} /> :
              type.name === 'Weekly' ? <Calendar size={18} /> :
              type.name === 'Monthly' ? <Timer size={18} /> :
              <Star size={18} />
            }
            title={type.name}
            value={type.value}
            subtitle={`${((type.value / (displayData?.totalTasks || 1)) * 100).toFixed(1)}% of total`}
            percentage={(type.value / (displayData?.totalTasks || 1)) * 100}
            pendingValue={type.pending}
            completedValue={type.completed}
          />
        ))}
      </div>

      {/* Enhanced Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Task Status Distribution - Enhanced Pie Chart */}
        <ThemeCard className="p-8" variant="glass">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-2xl text-white" style={{ background: `linear-gradient(135deg, var(--color-primary), var(--color-secondary))` }}>
                <PieChartIcon size={20} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[var(--color-text)]">
                  {user?.role === 'admin' ? 'Team Task Status' : 'Your Task Status'}
                </h3>
                <p className="text-xs text-[var(--color-textSecondary)]">
                  {user?.role === 'admin' ? 'Team distribution' : 'Your current distribution'}
                </p>
              </div>
            </div>
            <div className="text-sm px-4 py-2 rounded-full font-bold" style={{ backgroundColor: 'var(--color-primary)20', color: 'var(--color-primary)' }}>
              {statusData.reduce((sum, item) => sum + item.value, 0)} Total
            </div>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <defs>
                {statusData.map((entry, index) => (
                  <linearGradient key={index} id={`statusGradient-${index}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={entry.color} stopOpacity={0.8}/>
                    <stop offset="100%" stopColor={entry.color} stopOpacity={1}/>
                  </linearGradient>
                ))}
              </defs>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={120}
                innerRadius={50}
                fill="#8884d8"
                dataKey="value"
                stroke="var(--color-background)"
                strokeWidth={3}
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={`url(#statusGradient-${index})`} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </ThemeCard>

        {/* Task Type Breakdown - Enhanced Bar Chart */}
        <ThemeCard className="p-8" variant="glass">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-2xl text-white" style={{ background: `linear-gradient(135deg, var(--color-success), var(--color-accent))` }}>
                <BarChart3 size={20} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-[var(--color-text)]">
                  {user?.role === 'admin' ? 'Team Task Types' : 'Your Task Types'}
                </h3>
                <p className="text-xs text-[var(--color-textSecondary)]">
                  {user?.role === 'admin' ? 'Team breakdown by category' : 'Your breakdown by category'}
                </p>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={taskTypeData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <defs>
                {taskTypeData.map((entry, index) => (
                  <linearGradient key={index} id={`barGradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={entry.color} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={entry.color} stopOpacity={0.6}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="name"
                stroke="var(--color-textSecondary)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--color-textSecondary)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey="value"
                radius={[8, 8, 0, 0]}
                stroke="none"
              >
                {taskTypeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={`url(#barGradient-${index})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ThemeCard>
      </div>

      {/* Individual User Performance (Only show for non-admin users, moved after charts) */}
      {user?.role !== 'admin' && dashboardData?.userPerformance && (
        <UserPerformanceCard userPerformance={dashboardData.userPerformance} />
      )}

      {/* Enhanced Completion Trend and Recent Activity - Split 7:3 for non-admin users */}
      <div className={`grid grid-cols-1 ${user?.role !== 'admin' ? 'xl:grid-cols-10' : ''} gap-8`}>
        {/* Enhanced Completion Trend with Team Member Selector */}
        <ThemeCard className={`p-8 ${user?.role !== 'admin' ? 'xl:col-span-7' : ''}`} variant="glass">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <div className="p-4 rounded-3xl text-white shadow-2xl" style={{ background: `linear-gradient(135deg, var(--color-accent), var(--color-secondary))` }}>
                  <TrendingUp size={24} />
                </div>
                <div className="absolute -inset-1 rounded-3xl opacity-30 blur-lg" style={{ background: `linear-gradient(135deg, var(--color-accent), var(--color-secondary))` }}></div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-[var(--color-text)] mb-1">
                  {user?.role === 'admin' ? 'Team Completion Trend' : 'Your Completion Trend'}
                </h3>
                <p className="text-xs text-[var(--color-textSecondary)]">
                  {user?.role === 'admin' ? 'Team performance insights over the last 6 months' : 'Your performance insights over the last 6 months'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Team Member Selector - Only show for admin users */}
              {user?.role === 'admin' && teamMembersList.length > 0 && (
                <div className="relative z-10">
                  <button
                    onClick={() => setShowTeamMemberFilter(!showTeamMemberFilter)}
                    className="flex items-center px-4 py-2 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] shadow-lg hover:shadow-xl transition-all duration-200 text-[var(--color-text)] font-semibold"
                  >
                    <Users size={16} className="mr-2" />
                    <span>
                      {selectedTeamMember === 'all' ? 'All Team' : selectedTeamMember}
                    </span>
                    <ChevronDown size={16} className="ml-2" />
                  </button>
                  {showTeamMemberFilter && (
                    <div className="absolute right-0 top-full mt-2 w-64 z-20">
                      <ThemeCard className="p-3 max-h-80 overflow-y-auto" variant="elevated" hover={false}>
                        <div className="space-y-2">
                          <button
                            onClick={() => {
                              setSelectedTeamMember('all');
                              setShowTeamMemberFilter(false);
                            }}
                            className={`w-full text-left px-3 py-3 rounded-xl transition-all duration-200 ${
                              selectedTeamMember === 'all'
                                ? 'bg-[var(--color-primary)] text-white shadow-lg'
                                : 'hover:bg-[var(--color-border)] text-[var(--color-text)]'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                                  <Users size={16} />
                                </div>
                                <div>
                                  <span className="font-semibold">All Team</span>
                                  <p className="text-xs opacity-75">Overall team data</p>
                                </div>
                              </div>
                            </div>
                          </button>
                          {teamMembersList.map((member, index) => (
                            <button
                              key={member.username}
                              onClick={() => {
                                setSelectedTeamMember(member.username);
                                setShowTeamMemberFilter(false);
                              }}
                              className={`w-full text-left px-3 py-3 rounded-xl transition-all duration-200 ${
                                selectedTeamMember === member.username
                                  ? 'bg-[var(--color-primary)] text-white shadow-lg'
                                  : 'hover:bg-[var(--color-border)] text-[var(--color-text)]'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 rounded-xl bg-gradient-to-r from-blue-400 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                                    {member.username.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <span className="font-semibold">{member.username}</span>
                                    <p className="text-xs opacity-75">{member.totalTasks} tasks • {member.completionRate.toFixed(1)}% completion</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-bold opacity-75">#{index + 1}</div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </ThemeCard>
                    </div>
                  )}
                </div>
              )}

              {/* Stats Display */}
              <div className="flex items-center space-x-6 bg-[var(--color-surface)]/50 backdrop-blur-sm rounded-2xl p-4 border border-[var(--color-border)]">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-4 h-4 rounded-full shadow-lg" style={{ background: `linear-gradient(135deg, var(--color-success), var(--color-primary))` }}></div>
                    <div className="absolute inset-0 w-4 h-4 rounded-full animate-pulse opacity-50" style={{ background: `linear-gradient(135deg, var(--color-success), var(--color-primary))` }}></div>
                  </div>
                  <span className="text-sm font-semibold text-[var(--color-text)]">Completed</span>
                  <div className="text-lg font-bold" style={{ color: 'var(--color-success)' }}>
                    {trendData.reduce((sum, item) => sum + item.completed, 0)}
                  </div>
                </div>
                <div className="w-px h-8 bg-[var(--color-border)]"></div>
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="w-4 h-4 rounded-full shadow-lg" style={{ background: `linear-gradient(135deg, var(--color-warning), var(--color-secondary))` }}></div>
                    <div className="absolute inset-0 w-4 h-4 rounded-full animate-pulse opacity-50" style={{ background: `linear-gradient(135deg, var(--color-warning), var(--color-secondary))` }}></div>
                  </div>
                  <span className="text-sm font-semibold text-[var(--color-text)]">Planned</span>
                  <div className="text-lg font-bold" style={{ color: 'var(--color-warning)' }}>
                    {trendData.reduce((sum, item) => sum + item.planned, 0)}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Selected Member Info Banner */}
          {user?.role === 'admin' && selectedTeamMember !== 'all' && (
            <div className="mb-6 p-4 rounded-2xl border border-[var(--color-primary)]/30" style={{ backgroundColor: 'var(--color-primary)05' }}>
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-r from-blue-400 to-purple-600 flex items-center justify-center text-white font-bold">
                  {selectedTeamMember.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-lg font-bold text-[var(--color-text)]">
                    {selectedTeamMember}'s Performance Trend
                  </h4>
                  <p className="text-sm text-[var(--color-textSecondary)]">
                    Showing individual completion data for {selectedTeamMember}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="relative">
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart data={trendData} margin={{ top: 30, right: 40, left: 20, bottom: 20 }}>
                <defs>
                  <linearGradient id="completedAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0.1}/>
                  </linearGradient>
                  <linearGradient id="completedStrokeGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="var(--color-success)"/>
                    <stop offset="100%" stopColor="var(--color-primary)"/>
                  </linearGradient>
                  <linearGradient id="plannedAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-warning)" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="var(--color-warning)" stopOpacity={0.05}/>
                  </linearGradient>
                  <linearGradient id="plannedStrokeGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="var(--color-warning)"/>
                    <stop offset="100%" stopColor="var(--color-secondary)"/>
                  </linearGradient>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="5" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                  <filter id="dropshadow" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow dx="0" dy="4" stdDeviation="5" floodOpacity="0.4"/>
                  </filter>
                </defs>
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="var(--color-border)"
                  strokeOpacity={0.4}
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  stroke="var(--color-textSecondary)"
                  fontSize={13}
                  fontWeight={500}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                  tick={{ fill: 'var(--color-textSecondary)' }}
                />
                <YAxis
                  stroke="var(--color-textSecondary)"
                  fontSize={12}
                  fontWeight={500}
                  tickLine={false}
                  axisLine={false}
                  dx={-10}
                  tick={{ fill: 'var(--color-textSecondary)' }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-[var(--color-surface)]/95 backdrop-blur-xl border border-[var(--color-border)] rounded-2xl p-4 shadow-2xl">
                          <p className="text-sm font-bold text-[var(--color-text)] mb-3">
                            {label} {new Date().getFullYear()}
                            {selectedTeamMember !== 'all' && (
                              <span className="block text-xs opacity-75">
                                {selectedTeamMember}'s Data
                              </span>
                            )}
                          </p>
                          <div className="space-y-2">
                            {payload.map((entry: any, index: number) => (
                              <div key={index} className="flex items-center justify-between space-x-4">
                                <div className="flex items-center space-x-2">
                                  <div
                                    className="w-3 h-3 rounded-full shadow-sm"
                                    style={{ backgroundColor: entry.color }}
                                  ></div>
                                  <span className="text-sm font-medium text-[var(--color-textSecondary)]">
                                    {entry.name}:
                                  </span>
                                </div>
                                <span className="text-sm font-bold" style={{ color: entry.color }}>
                                  {entry.value}
                                </span>
                              </div>
                            ))}
                          </div>   
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="planned"
                  stroke="url(#plannedStrokeGradient)"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#plannedAreaGradient)"
                  name="Planned Tasks"
                  dot={{
                    fill: 'var(--color-warning)',
                    stroke: 'var(--color-background)',
                    strokeWidth: 2,
                    r: 5,
                  }}
                  activeDot={{
                    r: 7,
                    fill: 'var(--color-warning)',
                    stroke: 'var(--color-background)',
                    strokeWidth: 3,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  stroke="url(#completedStrokeGradient)"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#completedAreaGradient)"
                  name="Completed Tasks"
                  dot={{
                    fill: 'var(--color-success)',
                    stroke: 'var(--color-background)',
                    strokeWidth: 2,
                    r: 5,
                  }}
                  activeDot={{
                    r: 7,
                    fill: 'var(--color-success)',
                    stroke: 'var(--color-background)',
                    strokeWidth: 3,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="absolute top-4 right-4 opacity-20">
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--color-primary)' }}></div>
            </div>
            <div className="absolute bottom-8 left-8 opacity-15">
              <div className="w-3 h-3 rounded-full animate-pulse delay-1000" style={{ backgroundColor: 'var(--color-accent)' }}></div>
            </div>
          </div>
          <div className="mt-4 pt-2 border-t border-[var(--color-border)] grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="text-center p-2 rounded-2xl" style={{ backgroundColor: 'var(--color-success)10' }}>
              <div className="text-2xl font-bold mb-1" style={{ color: 'var(--color-success)' }}>
                {Math.max(...trendData.map(d => d.completed))}
              </div>
              <p className="text-xs font-semibold text-[var(--color-textSecondary)]">
                {selectedTeamMember !== 'all' ? 'Peak Month' : 'Peak Month'}
              </p>
            </div>
            <div className="text-center p-2 rounded-2xl" style={{ backgroundColor: 'var(--color-primary)10' }}>
              <div className="text-2xl font-bold mb-1" style={{ color: 'var(--color-primary)' }}>
                {(trendData.reduce((sum, item) => sum + item.completed, 0) / trendData.length).toFixed(1)}
              </div>
              <p className="text-xs font-semibold text-[var(--color-textSecondary)]">Avg per Month</p>
            </div>
            <div className="text-center p-2 rounded-2xl" style={{ backgroundColor: 'var(--color-info)10' }}>
              <div className="text-2xl font-bold mb-1" style={{ color: 'var(--color-info)' }}>
                {trendData.length > 1 ?
                  (((trendData[trendData.length - 1].completed - trendData[0].completed) / (trendData[0].completed || 1)) * 100).toFixed(0) + '%'
                  : '0%'}
              </div>
              <p className="text-xs font-semibold text-[var(--color-textSecondary)]">Growth Rate</p>
            </div>
          </div>
        </ThemeCard>

        {/* Recent Activity - Only show for non-admin users in 3-column layout */}
        {user?.role !== 'admin' && (
          <ThemeCard className="p-8 xl:col-span-3" variant="glass">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-2xl text-white" style={{ background: `linear-gradient(135deg, var(--color-success), var(--color-primary))` }}>
                  <Activity size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[var(--color-text)]">
                    Your Recent Activity
                  </h3>
                  <p className="text-xs text-[var(--color-textSecondary)]">
                    Your latest task updates
                  </p>
                </div>
              </div>
              <div className="text-sm px-4 py-2 rounded-full font-bold whitespace-nowrap" style={{ backgroundColor: 'var(--color-success)20', color: 'var(--color-success)' }}>
                Last {dashboardData?.recentActivity?.slice(0, 10).length || 0}
              </div>
            </div>
            <div className="space-y-3 max-h-[650px] overflow-y-auto">
              {dashboardData?.recentActivity?.slice(0, 10).map((activity, index) => (
                <div
                  key={activity._id}
                  className="flex items-start space-x-4 p-4 rounded-2xl border border-[var(--color-border)] hover:border-[var(--color-primary)]/30 transition-all duration-200"
                  style={{ backgroundColor: 'var(--color-surface)' }}
                >
                  <div className="p-2 rounded-xl shadow-sm" style={{ backgroundColor: 'var(--color-background)' }}>
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text)] mb-1">
                      <span className="mx-1 text-[var(--color-textSecondary)]">
                        {activity.type === 'assigned' && 'You were assigned'}
                        {activity.type === 'completed' && 'You completed'}
                        {activity.type === 'overdue' && 'You have overdue'}
                      </span>
                      <span className="font-bold">{activity.title}</span>
                    </p>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-1 sm:space-y-0 sm:space-x-3">
                      <span className="text-xs px-3 py-1 rounded-full font-semibold" style={{ backgroundColor: 'var(--color-primary)20', color: 'var(--color-primary)' }}>
                        {activity.taskType}
                      </span>
                      <span className="text-xs text-[var(--color-textSecondary)]">
                        {format(new Date(activity.date), 'MMM d, h:mm a')}
                      </span>
                    </div>
                  </div>
                </div>
              )) || (
                <div className="text-center py-12 text-[var(--color-textSecondary)]">
                  <Activity size={48} className="mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-semibold opacity-60">No recent activity</p>
                  <p className="text-sm opacity-40">Activity will appear here as tasks are updated</p>
                </div>
              )}
            </div>
          </ThemeCard>
        )}
      </div>

      {/* Team Performance & Recent Activity for Admin */}
      {user?.role === 'admin' && (
        <div className="grid grid-cols-1 xl:grid-cols-10 gap-8">
          {dashboardData?.teamPerformance && dashboardData.teamPerformance.length > 0 && (
            <ThemeCard className="p-8 xl:col-span-7" variant="glass">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <div className="flex items-center space-x-3">
                  <div className="p-3 rounded-2xl text-white" style={{ background: `linear-gradient(135deg, var(--color-warning), var(--color-accent))` }}>
                    <Trophy size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[var(--color-text)]">Team Performance</h3>
                    <p className="text-xs text-[var(--color-textSecondary)]">Top performers {viewMode === 'current' ? `this ${format(selectedMonth, 'MMMM')}` : 'all time'}</p>
                  </div>
                </div>
                <div className="text-sm px-4 py-2 rounded-full font-bold whitespace-nowrap" style={{ backgroundColor: 'var(--color-warning)20', color: 'var(--color-warning)' }}>
                  Top {Math.min(dashboardData.teamPerformance.length, 6)}
                </div>
              </div>
              <div className="space-y-4 max-h-[650px] overflow-y-auto">
                {dashboardData.teamPerformance.slice(0, 6).map((member, index) => (
                  <TeamMemberCard key={member.username} member={member} rank={index + 1} />
                ))}
              </div>
            </ThemeCard>
          )}

          <ThemeCard className="p-8 xl:col-span-3" variant="glass">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-2xl text-white" style={{ background: `linear-gradient(135deg, var(--color-success), var(--color-primary))` }}>
                  <Activity size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-[var(--color-text)]">
                    Recent Activity
                  </h3>
                  <p className="text-xs text-[var(--color-textSecondary)]">
                    Latest team task updates
                  </p>
                </div>
              </div>
              <div className="text-sm px-4 py-2 rounded-full font-bold whitespace-nowrap" style={{ backgroundColor: 'var(--color-success)20', color: 'var(--color-success)' }}>
                Last {dashboardData?.recentActivity?.slice(0, 10).length || 0}
              </div>
            </div>
            <div className="space-y-3 max-h-[650px] overflow-y-auto">
              {dashboardData?.recentActivity?.slice(0, 10).map((activity, index) => (
                <div
                  key={activity._id}
                  className="flex items-start space-x-4 p-4 rounded-2xl border border-[var(--color-border)] hover:border-[var(--color-primary)]/30 transition-all duration-200"
                  style={{ backgroundColor: 'var(--color-surface)' }}
                >
                  <div className="p-2 rounded-xl shadow-sm" style={{ backgroundColor: 'var(--color-background)' }}>
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text)] mb-1">
                      <span className="font-bold">{activity.username}</span>
                      <span className="mx-1 text-[var(--color-textSecondary)]">
                        {activity.type === 'assigned' && 'was assigned'}
                        {activity.type === 'completed' && 'completed'}
                        {activity.type === 'overdue' && 'has overdue'}
                      </span>
                      <span className="font-bold">{activity.title}</span>
                    </p>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-1 sm:space-y-0 sm:space-x-3">
                      <span className="text-xs px-3 py-1 rounded-full font-semibold" style={{ backgroundColor: 'var(--color-primary)20', color: 'var(--color-primary)' }}>
                        {activity.taskType}
                      </span>
                      <span className="text-xs text-[var(--color-textSecondary)]">
                        {format(new Date(activity.date), 'MMM d, h:mm a')}
                      </span>
                    </div>
                  </div>
                </div>
              )) || (
                <div className="text-center py-12 text-[var(--color-textSecondary)]">
                  <Activity size={48} className="mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-semibold opacity-60">No recent activity</p>
                  <p className="text-sm opacity-40">Activity will appear here as tasks are updated</p>
                </div>
              )}
            </div>
          </ThemeCard>
        </div>
      )}
    </div>
  );
};

export default Dashboard;