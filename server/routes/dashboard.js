import express from 'express';
import Task from '../models/Task.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

const router = express.Router();

// Get dashboard analytics
router.get('/analytics', async (req, res) => {
  try {
    const { userId, isAdmin, startDate, endDate } = req.query;

    // Convert userId to ObjectId for proper MongoDB queries
    const userObjectId = userId ? new mongoose.Types.ObjectId(userId) : null;

    let baseQuery = { isActive: true };
    if (isAdmin !== 'true' && userObjectId) {
      baseQuery.assignedTo = userObjectId;
    }

    let dateRangeQueryForStats = {};
    if (startDate && endDate) {
      dateRangeQueryForStats = {
        $or: [
          { dueDate: { $gte: new Date(startDate), $lte: new Date(endDate) } },
          { nextDueDate: { $gte: new Date(startDate), $lte: new Date(endDate) } }
        ]
      };
    }

    // Status stats - filtered by user if not admin
    const statusStats = await Task.aggregate([
      { $match: { ...baseQuery, ...dateRangeQueryForStats } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Type stats - filtered by user if not admin
    const typeStats = await Task.aggregate([
      { $match: { ...baseQuery, ...dateRangeQueryForStats } },
      { $group: { _id: '$taskType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Priority stats - filtered by user if not admin
    const priorityStats = await Task.aggregate([
      { $match: { ...baseQuery, ...dateRangeQueryForStats } },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Completion trend should always show last 6 months + current month data
    // but filtered by user if not admin
    const currentDate = new Date();
    const sixMonthsAgo = new Date(currentDate.getFullYear(), currentDate.getMonth() - 5, 1);
    const endOfCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);

    const completionTrend = await Task.aggregate([
      {
        $match: {
          ...baseQuery,
          status: 'completed',
          completedAt: { 
            $ne: null,
            $gte: sixMonthsAgo,
            $lte: endOfCurrentMonth
          }
        }
      },
      {
        $group: {
          _id: {
            month: { $month: '$completedAt' },
            year: { $year: '$completedAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Planned trend should also show last 6 months + current month data
    // but filtered by user if not admin
    const plannedTrend = await Task.aggregate([
      {
        $match: {
          ...baseQuery,
          isActive: true,
          $or: [
            { dueDate: { $ne: null } },
            { nextDueDate: { $ne: null } }
          ]
        }
      },
      {
        $addFields: {
          relevantDate: { $ifNull: ['$nextDueDate', '$dueDate'] }
        }
      },
      {
        $match: {
          relevantDate: {
            $gte: sixMonthsAgo,
            $lte: endOfCurrentMonth
          }
        }
      },
      {
        $group: {
          _id: {
            month: { $month: '$relevantDate' },
            year: { $year: '$relevantDate' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    let teamPerformance = [];
    let userPerformance = null;

    if (isAdmin === 'true') {
      // Admin: Get team performance
      const users = await User.find({ isActive: true }).select('_id username');
      for (const user of users) {
        let dateQueryForTeam = {};
        if (startDate && endDate) {
          dateQueryForTeam = {
            $or: [
              { dueDate: { $gte: new Date(startDate), $lte: new Date(endDate) } },
              { nextDueDate: { $gte: new Date(startDate), $lte: new Date(endDate) } }
            ]
          };
        }
        const userBaseQuery = {
          isActive: true,
          assignedTo: user._id,
          ...dateQueryForTeam
        };
        const totalTasks = await Task.countDocuments(userBaseQuery);

        let completedTasksForRateQuery = {
          isActive: true,
          assignedTo: user._id,
          status: 'completed',
          completedAt: { $ne: null },
          ...dateQueryForTeam
        };
        const completedTasksForRate = await Task.countDocuments(completedTasksForRateQuery);

        const completedTasks = await Task.countDocuments({
          isActive: true,
          assignedTo: user._id,
          status: 'completed',
          ...dateQueryForTeam,
          completedAt: { $ne: null }
        });

        const pendingTasks = await Task.countDocuments({ ...userBaseQuery, status: 'pending' });

        const oneTimeTasks = await Task.countDocuments({ ...userBaseQuery, taskType: 'one-time' });
        const oneTimePending = await Task.countDocuments({ ...userBaseQuery, taskType: 'one-time', status: 'pending' });
        const oneTimeCompleted = await Task.countDocuments({ ...userBaseQuery, taskType: 'one-time', status: 'completed' });

        const dailyTasks = await Task.countDocuments({ ...userBaseQuery, taskType: 'daily' });
        const dailyPending = await Task.countDocuments({ ...userBaseQuery, taskType: 'daily', status: 'pending' });
        const dailyCompleted = await Task.countDocuments({ ...userBaseQuery, taskType: 'daily', status: 'completed' });

        const weeklyTasks = await Task.countDocuments({ ...userBaseQuery, taskType: 'weekly' });
        const weeklyPending = await Task.countDocuments({ ...userBaseQuery, taskType: 'weekly', status: 'pending' });
        const weeklyCompleted = await Task.countDocuments({ ...userBaseQuery, taskType: 'weekly', status: 'completed' });

        const monthlyTasks = await Task.countDocuments({ ...userBaseQuery, taskType: 'monthly' });
        const monthlyPending = await Task.countDocuments({ ...userBaseQuery, taskType: 'monthly', status: 'pending' });
        const monthlyCompleted = await Task.countDocuments({ ...userBaseQuery, taskType: 'monthly', status: 'completed' });

        const yearlyTasks = await Task.countDocuments({ ...userBaseQuery, taskType: 'yearly' });
        const yearlyPending = await Task.countDocuments({ ...userBaseQuery, taskType: 'yearly', status: 'pending' });
        const yearlyCompleted = await Task.countDocuments({ ...userBaseQuery, taskType: 'yearly', status: 'completed' });

        const recurringTasks = dailyTasks + weeklyTasks + monthlyTasks + yearlyTasks;
        const recurringPending = dailyPending + weeklyPending + monthlyPending + yearlyPending;
        const recurringCompleted = dailyCompleted + weeklyCompleted + monthlyCompleted + yearlyCompleted;

        // Calculate on-time completion rate
        let onTimeQuery = {
          isActive: true,
          assignedTo: user._id,
          status: 'completed',
          completedAt: { $ne: null },
          ...dateQueryForTeam,
          $expr: {
            $lte: ['$completedAt', { $add: ['$dueDate', 24 * 60 * 60 * 1000] }]
          }
        };


        const onTimeCompletedTasks = await Task.countDocuments(onTimeQuery);
        const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
        const onTimeRate = completedTasksForRate > 0 ? (onTimeCompletedTasks / completedTasksForRate) * 100 : 0;

        // Calculate on-time for Recurring tasks
        let recurringOnTimeQuery = {
          ...onTimeQuery,
          taskType: { $in: ['daily', 'weekly', 'monthly', 'yearly'] }
        };
        const onTimeCompletedRecurringTasks = await Task.countDocuments(recurringOnTimeQuery);

        if (totalTasks > 0 || completedTasks > 0 || pendingTasks > 0) {
          teamPerformance.push({
            username: user.username,
            totalTasks,
            completedTasks,
            pendingTasks,
            oneTimeTasks,
            oneTimePending,
            oneTimeCompleted,
            dailyTasks,
            dailyPending,
            dailyCompleted,
            weeklyTasks,
            weeklyPending,
            weeklyCompleted,
            monthlyTasks,
            monthlyPending,
            monthlyCompleted,
            yearlyTasks,
            yearlyPending,
            yearlyCompleted,
            recurringTasks,
            recurringPending,
            recurringCompleted,
            completionRate: Math.round(completionRate * 10) / 10,
            onTimeRate: Math.round(onTimeRate * 10) / 10,
            onTimeCompletedTasks,
            onTimeRecurringCompleted: onTimeCompletedRecurringTasks
          });
        }
      }
      teamPerformance.sort((a, b) => b.completionRate - a.completionRate);
    } else {
      // Non-admin: Get individual user performance
      if (userObjectId) {
        const userData = await User.findById(userObjectId).select('username');
        if (userData) {
          let dateQueryForUser = {};
          if (startDate && endDate) {
            dateQueryForUser = {
              $or: [
                { dueDate: { $gte: new Date(startDate), $lte: new Date(endDate) } },
                { nextDueDate: { $gte: new Date(startDate), $lte: new Date(endDate) } }
              ]
            };
          }
          
          const userBaseQuery = {
            isActive: true,
            assignedTo: userObjectId,
            ...dateQueryForUser
          };

          const totalTasks = await Task.countDocuments(userBaseQuery);

          let completedTasksForRateQuery = {
            isActive: true,
            assignedTo: userObjectId,
            status: 'completed',
            completedAt: { $ne: null },
            ...dateQueryForUser
          };
          const completedTasksForRate = await Task.countDocuments(completedTasksForRateQuery);

          const completedTasks = await Task.countDocuments({
            isActive: true,
            assignedTo: userObjectId,
            status: 'completed',
            ...dateQueryForUser,
            completedAt: { $ne: null }
          });

          const pendingTasks = await Task.countDocuments({ ...userBaseQuery, status: 'pending' });

          const oneTimeTasks = await Task.countDocuments({ ...userBaseQuery, taskType: 'one-time' });
          const oneTimePending = await Task.countDocuments({ ...userBaseQuery, taskType: 'one-time', status: 'pending' });
          const oneTimeCompleted = await Task.countDocuments({ ...userBaseQuery, taskType: 'one-time', status: 'completed' });

          const dailyTasks = await Task.countDocuments({ ...userBaseQuery, taskType: 'daily' });
          const dailyPending = await Task.countDocuments({ ...userBaseQuery, taskType: 'daily', status: 'pending' });
          const dailyCompleted = await Task.countDocuments({ ...userBaseQuery, taskType: 'daily', status: 'completed' });

          const weeklyTasks = await Task.countDocuments({ ...userBaseQuery, taskType: 'weekly' });
          const weeklyPending = await Task.countDocuments({ ...userBaseQuery, taskType: 'weekly', status: 'pending' });
          const weeklyCompleted = await Task.countDocuments({ ...userBaseQuery, taskType: 'weekly', status: 'completed' });

          const monthlyTasks = await Task.countDocuments({ ...userBaseQuery, taskType: 'monthly' });
          const monthlyPending = await Task.countDocuments({ ...userBaseQuery, taskType: 'monthly', status: 'pending' });
          const monthlyCompleted = await Task.countDocuments({ ...userBaseQuery, taskType: 'monthly', status: 'completed' });

          const yearlyTasks = await Task.countDocuments({ ...userBaseQuery, taskType: 'yearly' });
          const yearlyPending = await Task.countDocuments({ ...userBaseQuery, taskType: 'yearly', status: 'pending' });
          const yearlyCompleted = await Task.countDocuments({ ...userBaseQuery, taskType: 'yearly', status: 'completed' });

          const recurringTasks = dailyTasks + weeklyTasks + monthlyTasks + yearlyTasks;
          const recurringPending = dailyPending + weeklyPending + monthlyPending + yearlyPending;
          const recurringCompleted = dailyCompleted + weeklyCompleted + monthlyCompleted + yearlyCompleted;

          // Calculate on-time completion rate
          let onTimeQuery = {
            isActive: true,
            assignedTo: userObjectId,
            status: 'completed',
            completedAt: { $ne: null },
            ...dateQueryForUser,
            $expr: {
              $lte: ['$completedAt', { $add: ['$dueDate', 24 * 60 * 60 * 1000] }]
            }
          };


          const onTimeCompletedTasks = await Task.countDocuments(onTimeQuery);
          const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
          const onTimeRate = completedTasksForRate > 0 ? (onTimeCompletedTasks / completedTasksForRate) * 100 : 0;

          // Calculate on-time for Recurring tasks
          let recurringOnTimeQuery = {
            ...onTimeQuery,
            taskType: { $in: ['daily', 'weekly', 'monthly', 'yearly'] }
          };
          const onTimeCompletedRecurringTasks = await Task.countDocuments(recurringOnTimeQuery);

          userPerformance = {
            username: userData.username,
            totalTasks,
            completedTasks,
            pendingTasks,
            oneTimeTasks,
            oneTimePending,
            oneTimeCompleted,
            dailyTasks,
            dailyPending,
            dailyCompleted,
            weeklyTasks,
            weeklyPending,
            weeklyCompleted,
            monthlyTasks,
            monthlyPending,
            monthlyCompleted,
            yearlyTasks,
            yearlyPending,
            yearlyCompleted,
            recurringTasks,
            recurringPending,
            recurringCompleted,
            completionRate: Math.round(completionRate * 10) / 10,
            onTimeRate: Math.round(onTimeRate * 10) / 10,
            onTimeCompletedTasks,
            onTimeRecurringCompleted: onTimeCompletedRecurringTasks
          };
        }
      }
    }

    // Recent activity - filtered by user if not admin
    let recentActivityQuery = {
      isActive: true,
      ...(isAdmin !== 'true' && userObjectId ? { assignedTo: userObjectId } : {})
    };
    if (startDate && endDate) {
      recentActivityQuery = {
        ...recentActivityQuery,
        $or: [
          { createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) } },
          { completedAt: { $gte: new Date(startDate), $lte: new Date(endDate) }, status: 'completed' },
          { dueDate: { $gte: new Date(startDate), $lte: new Date(endDate) }, status: 'overdue' }
        ]
      };
    }
    const recentActivity = await Task.aggregate([
      { $match: recentActivityQuery },
      {
        $lookup: {
          from: 'users',
          localField: 'assignedTo',
          foreignField: '_id',
          as: 'assignedUser'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'assignedBy',
          foreignField: '_id',
          as: 'assignedByUser'
        }
      },
      {
        $addFields: {
          activityType: {
            $cond: {
              if: { $eq: ['$status', 'completed'] },
              then: 'completed',
              else: {
                $cond: {
                  if: { $eq: ['$status', 'overdue'] },
                  then: 'overdue',
                  else: 'assigned'
                }
              }
            }
          },
          activityDate: {
            $cond: {
              if: { $eq: ['$status', 'completed'] },
              then: '$completedAt',
              else: '$createdAt'
            }
          }
        }
      },
      {
        $project: {
          title: 1,
          taskType: 1,
          type: '$activityType',
          username: { $arrayElemAt: ['$assignedUser.username', 0] },
          assignedBy: { $arrayElemAt: ['$assignedByUser.username', 0] },
          date: '$activityDate'
        }
      },
      { $sort: { date: -1 } },
      { $limit: 20 }
    ]);

    const totalActiveTasks = await Task.countDocuments({ ...baseQuery, ...dateRangeQueryForStats });

    let completedTasksCountQuery = {
      ...baseQuery,
      status: 'completed',
      completedAt: { $ne: null }
    };
    if (startDate && endDate) {
      completedTasksCountQuery = {
        ...completedTasksCountQuery,
        ...dateRangeQueryForStats
      };
    }
    const completedTasksCount = await Task.countDocuments(completedTasksCountQuery);

    // On-time completion rate (overall)
    let onTimeQueryOverall = {
      ...baseQuery,
      status: 'completed',
      completedAt: { $ne: null },
      $expr: {
        $lte: ['$completedAt', { $add: ['$dueDate', 24 * 60 * 60 * 1000] }]
      }
    };

    if (startDate && endDate) {
      onTimeQueryOverall = {
        ...onTimeQueryOverall,
        ...dateRangeQueryForStats
      };
    }

    const onTimeCompletions = await Task.countDocuments(onTimeQueryOverall);

    let oneTimeOnTimeQueryOverall = {
      ...onTimeQueryOverall,
      taskType: 'one-time'
    };
    const onTimeCompletedOneTimeOverall = await Task.countDocuments(oneTimeOnTimeQueryOverall);

    const completedOneTimeTasksOverallForRate = await Task.countDocuments({
      ...baseQuery,
      taskType: 'one-time',
      status: 'completed',
      completedAt: { $ne: null },
      ...(startDate && endDate ? dateRangeQueryForStats : {})
    });
    const oneTimeOnTimeRateOverall = completedOneTimeTasksOverallForRate > 0 ? (onTimeCompletedOneTimeOverall / completedOneTimeTasksOverallForRate) * 100 : 0;

    let recurringOnTimeQueryOverall = {
      ...onTimeQueryOverall,
      taskType: { $in: ['daily', 'weekly', 'monthly', 'yearly'] }
    };
    const onTimeCompletedRecurringOverall = await Task.countDocuments(recurringOnTimeQueryOverall);

    const completedRecurringTasksOverallForRate = await Task.countDocuments({
      ...baseQuery,
      taskType: { $in: ['daily', 'weekly', 'monthly', 'yearly'] },
      status: 'completed',
      completedAt: { $ne: null },
      ...(startDate && endDate ? dateRangeQueryForStats : {})
    });
    const recurringOnTimeRateOverall = completedRecurringTasksOverallForRate > 0 ? (onTimeCompletedRecurringOverall / completedRecurringTasksOverallForRate) * 100 : 0;

    const completionTimes = await Task.aggregate([
      {
        $match: {
          ...baseQuery,
          ...dateRangeQueryForStats,
          status: 'completed',
          completedAt: { $ne: null }
        }
      },
      {
        $addFields: {
          targetDate: '$dueDate',
          daysTaken: {
            $divide: [
              { $subtract: ['$completedAt', '$createdAt'] },
              1000 * 60 * 60 * 24
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgDays: { $avg: '$daysTaken' }
        }
      }
    ]);

    const performanceMetrics = {
      onTimeCompletion: completedTasksCount > 0 ? Math.round((onTimeCompletions / completedTasksCount) * 100) : 0,
      averageCompletionTime: completionTimes.length > 0 ? Math.round(completionTimes[0].avgDays) : 0,
      taskDistribution: typeStats.map(item => ({
        type: item._id,
        count: item.count,
        percentage: totalActiveTasks > 0 ? Math.round((item.count / totalActiveTasks) * 100) : 0
      })),
      oneTimeOnTimeRate: Math.round(oneTimeOnTimeRateOverall * 10) / 10,
      recurringOnTimeRate: Math.round(recurringOnTimeRateOverall * 10) / 10
    };

    res.json({
      statusStats,
      typeStats,
      priorityStats,
      completionTrend,
      plannedTrend,
      teamPerformance,
      userPerformance,
      recentActivity,
      performanceMetrics
    });
  } catch (error) {
    console.error('Dashboard analytics error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get individual team member trend data
router.get('/member-trend', async (req, res) => {
  try {
    const { memberUsername, isAdmin, startDate, endDate } = req.query;

    if (isAdmin !== 'true') {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (!memberUsername) {
      return res.status(400).json({ message: 'Member username is required' });
    }

    // Find the user by username
    const user = await User.findOne({ username: memberUsername, isActive: true }).select('_id username');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const baseQuery = { 
      isActive: true, 
      assignedTo: user._id 
    };

    // Set up date range for trend calculation
    const currentDate = new Date();
    const sixMonthsAgo = new Date(currentDate.getFullYear(), currentDate.getMonth() - 5, 1);
    const endOfCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);

    // Get completion trend for this specific member
    const completionTrend = await Task.aggregate([
      {
        $match: {
          ...baseQuery,
          status: 'completed',
          completedAt: { 
            $ne: null,
            $gte: sixMonthsAgo,
            $lte: endOfCurrentMonth
          }
        }
      },
      {
        $group: {
          _id: {
            month: { $month: '$completedAt' },
            year: { $year: '$completedAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Get planned trend for this specific member
    const plannedTrend = await Task.aggregate([
      {
        $match: {
          ...baseQuery,
          isActive: true,
          $or: [
            { dueDate: { $ne: null } },
            { nextDueDate: { $ne: null } }
          ]
        }
      },
      {
        $addFields: {
          relevantDate: { $ifNull: ['$nextDueDate', '$dueDate'] }
        }
      },
      {
        $match: {
          relevantDate: {
            $gte: sixMonthsAgo,
            $lte: endOfCurrentMonth
          }
        }
      },
      {
        $group: {
          _id: {
            month: { $month: '$relevantDate' },
            year: { $year: '$relevantDate' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Generate trend data for the last 6 months including current month
    const trendMonths = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      const monthName = date.toLocaleString('default', { month: 'short' });
      const monthNum = date.getMonth() + 1;
      const yearNum = date.getFullYear();

      const matchingCompletedData = completionTrend.find(item =>
        item._id.month === monthNum && item._id.year === yearNum
      );

      const matchingPlannedData = plannedTrend.find(item =>
        item._id.month === monthNum && item._id.year === yearNum
      );

      trendMonths.push({
        month: monthName,
        completed: matchingCompletedData?.count || 0,
        planned: matchingPlannedData?.count || 0,
      });
    }

    res.json(trendMonths);
  } catch (error) {
    console.error('Member trend data error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get task counts with trends
router.get('/counts', async (req, res) => {
  try {
    const { userId, isAdmin, startDate, endDate } = req.query;

    // Convert userId to ObjectId for proper MongoDB queries
    const userObjectId = userId ? new mongoose.Types.ObjectId(userId) : null;

    let baseQuery = { isActive: true };
    let dateRangeQuery = {};
    
    if (isAdmin !== 'true' && userObjectId) {
      baseQuery.assignedTo = userObjectId;
    }
    
    // For all-time view (no startDate/endDate), get all data
    if (startDate && endDate) {
      dateRangeQuery = {
        $or: [
          { dueDate: { $gte: new Date(startDate), $lte: new Date(endDate) } },
          { nextDueDate: { $gte: new Date(startDate), $lte: new Date(endDate) } }
        ]
      };
    }

    // Calculate previous period for trend comparison
    let previousDateRangeQuery = {};

    if (startDate && endDate) {
      // For current month view, compare with previous month
      const currentStart = new Date(startDate);
      const currentEnd = new Date(endDate);
      const periodDuration = currentEnd.getTime() - currentStart.getTime();
      
      const previousEnd = new Date(currentStart.getTime() - 1);
      const previousStart = new Date(previousEnd.getTime() - periodDuration);

      previousDateRangeQuery = {
        $or: [
          { dueDate: { $gte: previousStart, $lte: previousEnd } },
          { nextDueDate: { $gte: previousStart, $lte: previousEnd } }
        ]
      };
    } else {
      // For all-time view, compare this year with last year
      const now = new Date();
      const currentYear = now.getFullYear();
      const previousYear = currentYear - 1;
      
      const currentYearStart = new Date(currentYear, 0, 1);
      const currentYearEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999);
      
      const previousYearStart = new Date(previousYear, 0, 1);
      const previousYearEnd = new Date(previousYear, 11, 31, 23, 59, 59, 999);

      // For all-time, we don't apply any date filter to current data
      // But we compare this year vs last year for trends
      previousDateRangeQuery = {
        $or: [
          { dueDate: { $gte: previousYearStart, $lte: previousYearEnd } },
          { nextDueDate: { $gte: previousYearStart, $lte: previousYearEnd } }
        ]
      };

      // Also set dateRangeQuery for this year's data for trend comparison
      const thisYearDateRangeQuery = {
        $or: [
          { dueDate: { $gte: currentYearStart, $lte: currentYearEnd } },
          { nextDueDate: { $gte: currentYearStart, $lte: currentYearEnd } }
        ]
      };

      // Get this year's data for trend comparison
      const [
        thisYearTotalTasks,
        thisYearPendingTasks,
        thisYearCompletedTasks,
        thisYearOverdueTasks
      ] = await Promise.all([
        Task.countDocuments({ ...baseQuery, ...thisYearDateRangeQuery }),
        Task.countDocuments({ ...baseQuery, ...thisYearDateRangeQuery, status: 'pending' }),
        Task.countDocuments({ ...baseQuery, ...thisYearDateRangeQuery, status: 'completed' }),
        Task.countDocuments({ ...baseQuery, ...thisYearDateRangeQuery, status: 'overdue' })
      ]);

      // Get previous year's data for trend comparison
      const [
        prevYearTotalTasks,
        prevYearPendingTasks,
        prevYearCompletedTasks,
        prevYearOverdueTasks
      ] = await Promise.all([
        Task.countDocuments({ ...baseQuery, ...previousDateRangeQuery }),
        Task.countDocuments({ ...baseQuery, ...previousDateRangeQuery, status: 'pending' }),
        Task.countDocuments({ ...baseQuery, ...previousDateRangeQuery, status: 'completed' }),
        Task.countDocuments({ ...baseQuery, ...previousDateRangeQuery, status: 'overdue' })
      ]);

      // Calculate trends for all-time view
      const calculateTrend = (current, previous) => {
        if (previous === 0 && current === 0) return { value: 0, direction: 'up' };
        if (previous === 0) return { value: 100, direction: 'up' };
        const change = ((current - previous) / previous) * 100;
        return {
          value: Math.abs(Math.round(change * 10) / 10),
          direction: change >= 0 ? 'up' : 'down'
        };
      };

      // Get all-time data (no date filters)
      const [
        totalTasks,
        pendingTasks,
        completedTasks,
        overdueTasks,
        oneTimeTasks,
        oneTimePending,
        oneTimeCompleted,
        dailyTasks,
        dailyPending,
        dailyCompleted,
        weeklyTasks,
        weeklyPending,
        weeklyCompleted,
        monthlyTasks,
        monthlyPending,
        monthlyCompleted,
        yearlyTasks,
        yearlyPending,
        yearlyCompleted
      ] = await Promise.all([
        Task.countDocuments(baseQuery),
        Task.countDocuments({ ...baseQuery, status: 'pending' }),
        Task.countDocuments({ ...baseQuery, status: 'completed' }),
        Task.countDocuments({ ...baseQuery, status: 'overdue' }),

        Task.countDocuments({ ...baseQuery, taskType: 'one-time' }),
        Task.countDocuments({ ...baseQuery, taskType: 'one-time', status: 'pending' }),
        Task.countDocuments({ ...baseQuery, taskType: 'one-time', status: 'completed' }),

        Task.countDocuments({ ...baseQuery, taskType: 'daily' }),
        Task.countDocuments({ ...baseQuery, taskType: 'daily', status: 'pending' }),
        Task.countDocuments({ ...baseQuery, taskType: 'daily', status: 'completed' }),

        Task.countDocuments({ ...baseQuery, taskType: 'weekly' }),
        Task.countDocuments({ ...baseQuery, taskType: 'weekly', status: 'pending' }),
        Task.countDocuments({ ...baseQuery, taskType: 'weekly', status: 'completed' }),

        Task.countDocuments({ ...baseQuery, taskType: 'monthly' }),
        Task.countDocuments({ ...baseQuery, taskType: 'monthly', status: 'pending' }),
        Task.countDocuments({ ...baseQuery, taskType: 'monthly', status: 'completed' }),

        Task.countDocuments({ ...baseQuery, taskType: 'yearly' }),
        Task.countDocuments({ ...baseQuery, taskType: 'yearly', status: 'pending' }),
        Task.countDocuments({ ...baseQuery, taskType: 'yearly', status: 'completed' })
      ]);

      const recurringTasks = dailyTasks + weeklyTasks + monthlyTasks + yearlyTasks;
      const recurringPending = dailyPending + weeklyPending + monthlyPending + yearlyPending;
      const recurringCompleted = dailyCompleted + weeklyCompleted + monthlyCompleted + yearlyCompleted;

      return res.json({
        totalTasks,
        pendingTasks,
        completedTasks,
        overdueTasks,
        oneTimeTasks,
        oneTimePending,
        oneTimeCompleted,
        recurringTasks,
        recurringPending,
        recurringCompleted,
        dailyTasks,
        dailyPending,
        dailyCompleted,
        weeklyTasks,
        weeklyPending,
        weeklyCompleted,
        monthlyTasks,
        monthlyPending,
        monthlyCompleted,
        yearlyTasks,
        yearlyPending,
        yearlyCompleted,
        trends: {
          totalTasks: calculateTrend(thisYearTotalTasks, prevYearTotalTasks),
          pendingTasks: calculateTrend(thisYearPendingTasks, prevYearPendingTasks),
          completedTasks: calculateTrend(thisYearCompletedTasks, prevYearCompletedTasks),
          overdueTasks: calculateTrend(thisYearOverdueTasks, prevYearOverdueTasks)
        }
      });
    }

    // Get current period data
    const [
      totalTasks,
      pendingTasks,
      completedTasks,
      overdueTasks,
      oneTimeTasks,
      oneTimePending,
      oneTimeCompleted,
      dailyTasks,
      dailyPending,
      dailyCompleted,
      weeklyTasks,
      weeklyPending,
      weeklyCompleted,
      monthlyTasks,
      monthlyPending,
      monthlyCompleted,
      yearlyTasks,
      yearlyPending,
      yearlyCompleted
    ] = await Promise.all([
      Task.countDocuments({ ...baseQuery, ...dateRangeQuery }),
      Task.countDocuments({ ...baseQuery, ...dateRangeQuery, status: 'pending' }),
      Task.countDocuments({ ...baseQuery, ...dateRangeQuery, status: 'completed' }),
      Task.countDocuments({ ...baseQuery, ...dateRangeQuery, status: 'overdue' }),

      Task.countDocuments({ ...baseQuery, ...dateRangeQuery, taskType: 'one-time' }),
      Task.countDocuments({ ...baseQuery, ...dateRangeQuery, taskType: 'one-time', status: 'pending' }),
      Task.countDocuments({ ...baseQuery, ...dateRangeQuery, taskType: 'one-time', status: 'completed' }),

      Task.countDocuments({ ...baseQuery, ...dateRangeQuery, taskType: 'daily' }),
      Task.countDocuments({ ...baseQuery, ...dateRangeQuery, taskType: 'daily', status: 'pending' }),
      Task.countDocuments({ ...baseQuery, ...dateRangeQuery, taskType: 'daily', status: 'completed' }),

      Task.countDocuments({ ...baseQuery, ...dateRangeQuery, taskType: 'weekly' }),
      Task.countDocuments({ ...baseQuery, ...dateRangeQuery, taskType: 'weekly', status: 'pending' }),
      Task.countDocuments({ ...baseQuery, ...dateRangeQuery, taskType: 'weekly', status: 'completed' }),

      Task.countDocuments({ ...baseQuery, ...dateRangeQuery, taskType: 'monthly' }),
      Task.countDocuments({ ...baseQuery, ...dateRangeQuery, taskType: 'monthly', status: 'pending' }),
      Task.countDocuments({ ...baseQuery, ...dateRangeQuery, taskType: 'monthly', status: 'completed' }),

      Task.countDocuments({ ...baseQuery, ...dateRangeQuery, taskType: 'yearly' }),
      Task.countDocuments({ ...baseQuery, ...dateRangeQuery, taskType: 'yearly', status: 'pending' }),
      Task.countDocuments({ ...baseQuery, ...dateRangeQuery, taskType: 'yearly', status: 'completed' })
    ]);

    // Get previous period data for trend calculation
    const [
      prevTotalTasks,
      prevPendingTasks,
      prevCompletedTasks,
      prevOverdueTasks
    ] = await Promise.all([
      Task.countDocuments({ ...baseQuery, ...previousDateRangeQuery }),
      Task.countDocuments({ ...baseQuery, ...previousDateRangeQuery, status: 'pending' }),
      Task.countDocuments({ ...baseQuery, ...previousDateRangeQuery, status: 'completed' }),
      Task.countDocuments({ ...baseQuery, ...previousDateRangeQuery, status: 'overdue' })
    ]);

    // Calculate trends
    const calculateTrend = (current, previous) => {
      if (previous === 0 && current === 0) return { value: 0, direction: 'up' };
      if (previous === 0) return { value: 100, direction: 'up' };
      const change = ((current - previous) / previous) * 100;
      return {
        value: Math.abs(Math.round(change * 10) / 10),
        direction: change >= 0 ? 'up' : 'down'
      };
    };

    const recurringTasks = dailyTasks + weeklyTasks + monthlyTasks + yearlyTasks;
    const recurringPending = dailyPending + weeklyPending + monthlyPending + yearlyPending;
    const recurringCompleted = dailyCompleted + weeklyCompleted + monthlyCompleted + yearlyCompleted;

    res.json({
      totalTasks,
      pendingTasks,
      completedTasks,
      overdueTasks,
      oneTimeTasks,
      oneTimePending,
      oneTimeCompleted,
      recurringTasks,
      recurringPending,
      recurringCompleted,
      dailyTasks,
      dailyPending,
      dailyCompleted,
      weeklyTasks,
      weeklyPending,
      weeklyCompleted,
      monthlyTasks,
      monthlyPending,
      monthlyCompleted,
      yearlyTasks,
      yearlyPending,
      yearlyCompleted,
      trends: {
        totalTasks: calculateTrend(totalTasks, prevTotalTasks),
        pendingTasks: calculateTrend(pendingTasks, prevPendingTasks),
        completedTasks: calculateTrend(completedTasks, prevCompletedTasks),
        overdueTasks: calculateTrend(overdueTasks, prevOverdueTasks)
      }
    });
  } catch (error) {
    console.error('Dashboard counts error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;