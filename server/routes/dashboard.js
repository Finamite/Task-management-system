import express from 'express';
import Task from '../models/Task.js';
import User from '../models/User.js';

const router = express.Router();

// Get dashboard analytics
router.get('/analytics', async (req, res) => {
  try {
    const { userId, isAdmin, startDate, endDate } = req.query;

    let baseQuery = { isActive: true };
    if (isAdmin !== 'true') {
      baseQuery.assignedTo = userId;
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

    const statusStats = await Task.aggregate([
      { $match: { ...baseQuery, ...dateRangeQueryForStats } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const typeStats = await Task.aggregate([
      { $match: { ...baseQuery, ...dateRangeQueryForStats } },
      { $group: { _id: '$taskType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const priorityStats = await Task.aggregate([
      { $match: { ...baseQuery, ...dateRangeQueryForStats } },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // FIXED: Completion trend should always show last 6 months + current month data
    // regardless of the date filter applied to other stats
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

    // FIXED: Planned trend should also show last 6 months + current month data
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
    if (isAdmin === 'true') {
      const users = await User.find({ isActive: true }).select('_id username');
      for (const user of users) {
        let dateQueryForTeam = {};
        if (startDate && endDate) {
          dateQueryForTeam = {
            $or: [
              { dueDate: { $gte: new Date(startDate), $lte: new Date(endDate) } },
              { completedAt: { $gte: new Date(startDate), $lte: new Date(endDate) }, status: 'completed' }
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
          completedAt: { $ne: null }
        };
        if (startDate && endDate) {
          completedTasksForRateQuery.completedAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }
        const completedTasksForRate = await Task.countDocuments(completedTasksForRateQuery);

        let completedTasksQueryForCompletionRate = { ...userBaseQuery, status: 'completed' };
        const completedTasks = await Task.countDocuments({
          isActive: true,
          assignedTo: user._id,
          status: 'completed',
          ...dateQueryForTeam
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
          $expr: {
            $lte: ['$completedAt', { $add: ['$dueDate', 24 * 60 * 60 * 1000] }]
          }
        };

        if (startDate && endDate) {
          onTimeQuery.completedAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        const onTimeCompletedTasks = await Task.countDocuments(onTimeQuery);
        const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
        const onTimeRate = completedTasksForRate > 0 ? (onTimeCompletedTasks / completedTasksForRate) * 100 : 0;

        // Calculate on-time for One-Time tasks
        let oneTimeOnTimeQuery = {
          ...onTimeQuery,
          taskType: 'one-time'
        };
        const onTimeCompletedOneTimeTasks = await Task.countDocuments(oneTimeOnTimeQuery);

        const oneTimeCompletedForRate = await Task.countDocuments({
          isActive: true,
          assignedTo: user._id,
          taskType: 'one-time',
          status: 'completed',
          completedAt: { $ne: null, ...(startDate && endDate && { $gte: new Date(startDate), $lte: new Date(endDate) }) }
        });
        const oneTimeOnTimeRate = oneTimeCompletedForRate > 0 ? (onTimeCompletedOneTimeTasks / oneTimeCompletedForRate) * 100 : 0;

        // Calculate on-time for Recurring tasks
        let recurringOnTimeQuery = {
          ...onTimeQuery,
          taskType: { $in: ['daily', 'weekly', 'monthly', 'yearly'] }
        };
        const onTimeCompletedRecurringTasks = await Task.countDocuments(recurringOnTimeQuery);

        const recurringCompletedForRate = await Task.countDocuments({
          isActive: true,
          assignedTo: user._id,
          taskType: { $in: ['daily', 'weekly', 'monthly', 'yearly'] },
          status: 'completed',
          completedAt: { $ne: null, ...(startDate && endDate && { $gte: new Date(startDate), $lte: new Date(endDate) }) }
        });

        const recurringOnTimeRate = recurringCompletedForRate > 0 ? (onTimeCompletedRecurringTasks / recurringCompletedForRate) * 100 : 0;

        if (totalTasks > 0 || completedTasks > 0 || pendingTasks > 0) {
          teamPerformance.push({
            username: user.username,
            totalTasks,
            completedTasks,
            pendingTasks,
            oneTimeTasks,
            oneTimePending,
            oneTimeCompleted,
            oneTimeOnTimeRate: Math.round(oneTimeOnTimeRate * 10) / 10,
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
            recurringOnTimeRate: Math.round(recurringOnTimeRate * 10) / 10,
            completionRate: Math.round(completionRate * 10) / 10,
            onTimeRate: Math.round(onTimeRate * 10) / 10,
            onTimeCompletedTasks
          });
        }
      }
      teamPerformance.sort((a, b) => b.completionRate - a.completionRate);
    }

    let recentActivityQuery = {
      isActive: true,
      ...(isAdmin !== 'true' ? { assignedTo: userId } : {})
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
      completedTasksCountQuery.completedAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
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
      onTimeQueryOverall.completedAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
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
      completedAt: { $ne: null, ...(startDate && endDate && { $gte: new Date(startDate), $lte: new Date(endDate) }) }
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
      completedAt: { $ne: null, ...(startDate && endDate && { $gte: new Date(startDate), $lte: new Date(endDate) }) }
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
      recentActivity,
      performanceMetrics
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get task counts
router.get('/counts', async (req, res) => {
  try {
    const { userId, isAdmin } = req.query;
    const { startDate, endDate } = req.query;

    let baseQuery = { isActive: true };
    let dateRangeQuery = {};
    if (isAdmin !== 'true') {
      baseQuery.assignedTo = userId;
    }
    if (startDate && endDate) {
      dateRangeQuery = {
        $or: [
          { dueDate: { $gte: new Date(startDate), $lte: new Date(endDate) } },
          { nextDueDate: { $gte: new Date(startDate), $lte: new Date(endDate) } }
        ]
      };
    }

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
      yearlyCompleted
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;