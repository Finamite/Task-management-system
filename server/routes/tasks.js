import express from 'express';
import Task from '../models/Task.js';
import User from '../models/User.js';

const router = express.Router();

// --- Helper Functions for Date Calculations ---

// Helper function to get all dates for daily tasks within a range
const getDailyTaskDates = (startDate, endDate, includeSunday) => {
  const dates = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    const dayOfWeek = current.getDay();
    
    // Skip Sunday if not included and it's a Sunday
    if (includeSunday || dayOfWeek !== 0) { // 0 is Sunday
      dates.push(new Date(current));
    }
    
    current.setDate(current.getDate() + 1); // Move to the next day
  }
  
  return dates;
};

// Helper function to get all dates for weekly tasks within a range based on selected days
const getWeeklyTaskDates = (startDate, endDate, selectedDays) => {
  const dates = [];
  const current = new Date(startDate);
  const end = new Date(endDate);
  
  while (current <= end) {
    const dayOfWeek = current.getDay();
    
    // If the current day of the week is among the selected days
    if (selectedDays.includes(dayOfWeek)) {
      dates.push(new Date(current));
    }
    
    current.setDate(current.getDate() + 1); // Move to the next day
  }
  
  return dates;
};

// Helper function to get all dates for monthly tasks with specific day within a range
const getMonthlyTaskDates = (startDate, endDate, monthlyDay, includeSunday) => {
  const dates = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Start from the first day of the start month
  const current = new Date(start.getFullYear(), start.getMonth(), 1);
  
  while (current <= end) {
    // Set to the target day of month
    let targetDate = new Date(current.getFullYear(), current.getMonth(), monthlyDay);
    
    // Handle case where monthlyDay doesn't exist in this month (e.g., Feb 30th)
    if (targetDate.getMonth() !== current.getMonth()) {
      // If the day is out of bounds for the current month, set to the last day of the month
      targetDate = new Date(current.getFullYear(), current.getMonth() + 1, 0);
    }
    
    // Check if the target date is within our overall date range
    if (targetDate >= start && targetDate <= end) {
      // Handle Sunday exclusion
      if (!includeSunday && targetDate.getDay() === 0) { // 0 is Sunday
        // If it's Sunday and Sundays are excluded, move to the next day (Monday)
        targetDate.setDate(targetDate.getDate() - 1);
        
        // Make sure we didn't accidentally go to the next month by moving to Monday
        // and that it's still within the overall end date
        if (targetDate.getMonth() === current.getMonth() && targetDate <= end) {
          dates.push(new Date(targetDate));
        }
      } else {
        dates.push(new Date(targetDate));
      }
    }
    
    current.setMonth(current.getMonth() + 1); // Move to the next month
  }
  
  return dates;
};

// Helper function to get all dates for quarterly tasks (4 tasks for one year)
const getQuarterlyTaskDates = (startDate, includeSunday = true) => {
  const dates = [];
  const start = new Date(startDate);
  
  // Create 4 quarterly tasks (every 3 months)
  for (let i = 0; i < 4; i++) {
    const quarterlyDate = new Date(start);
    quarterlyDate.setMonth(start.getMonth() + (i * 3)); // Add 3 months for each quarter
    
    // Handle Sunday exclusion for quarterly tasks
    if (!includeSunday && quarterlyDate.getDay() === 0) { // 0 is Sunday
      quarterlyDate.setDate(quarterlyDate.getDate() - 1); // Move to Saturday
    }
    
    dates.push(quarterlyDate);
  }
  
  return dates;
};

// Helper function to get all dates for yearly tasks based on duration
const getYearlyTaskDates = (startDate, yearlyDuration, includeSunday = true) => {
  const dates = [];
  const start = new Date(startDate);
  
  for (let i = 0; i < yearlyDuration; i++) {
    const yearlyDate = new Date(start);
    yearlyDate.setFullYear(start.getFullYear() + i); // Increment year
    
    // Handle Sunday exclusion for yearly tasks
    if (!includeSunday && yearlyDate.getDay() === 0) { // 0 is Sunday
      yearlyDate.setDate(yearlyDate.getDate() - 1); // Move to Saturday
    }
    
    dates.push(yearlyDate);
  }
  
  return dates;
};

// --- New Helper for Calculating Next Due Date for Recurring Tasks ---

/**
 * Calculates the next due date for a recurring task based on its type and current due date.
 * @param {Object} task - The task object from the database.
 * @returns {Date | null} The calculated next due date, or null if it's a one-time task.
 */
const calculateNextDueDate = (task) => {
  // Start calculation from the current due date of the task
  const currentDueDate = new Date(task.dueDate);
  let nextDueDate = new Date(currentDueDate); // Create a mutable copy

  switch (task.taskType) {
    case 'daily':
      // Advance by one day
      nextDueDate.setDate(nextDueDate.getDate() + 1);
      // If parentTaskInfo exists and Sundays are excluded, skip Sunday
      if (task.parentTaskInfo && task.parentTaskInfo.includeSunday === false) {
        if (nextDueDate.getDay() === 0) { // 0 is Sunday
          nextDueDate.setDate(nextDueDate.getDate() + 1); // Move to Monday
        }
      }
      break;
    case 'weekly':
      // Advance by one week (7 days)
      nextDueDate.setDate(nextDueDate.getDate() + 7);
      // For weekly tasks, the specific days of the week are handled during initial scheduling.
      // Simply advancing by a week should maintain the day of the week.
      break;
    case 'monthly':
      // Advance by one month
      nextDueDate.setMonth(nextDueDate.getMonth() + 1);
      // If a specific monthly day is set in parentTaskInfo, try to set the date to that day.
      if (task.parentTaskInfo && task.parentTaskInfo.monthlyDay) {
        const targetDay = task.parentTaskInfo.monthlyDay;
        // Check if the target day is valid for the new month. If not, set to the last day of the month.
        const lastDayOfNextMonth = new Date(nextDueDate.getFullYear(), nextDueDate.getMonth() + 1, 0).getDate();
        nextDueDate.setDate(Math.min(targetDay, lastDayOfNextMonth));
      }
      // If parentTaskInfo exists and Sundays are excluded, skip Sunday
      if (task.parentTaskInfo && task.parentTaskInfo.includeSunday === false) {
        if (nextDueDate.getDay() === 0) { // 0 is Sunday
          nextDueDate.setDate(nextDueDate.getDate() + 1); // Move to Monday
        }
      }
      break;
    case 'quarterly':
      // Advance by 3 months (one quarter)
      nextDueDate.setMonth(nextDueDate.getMonth() + 3);
      // If parentTaskInfo exists and Sundays are excluded, skip Sunday
      if (task.parentTaskInfo && task.parentTaskInfo.includeSunday === false) {
        if (nextDueDate.getDay() === 0) { // 0 is Sunday
          nextDueDate.setDate(nextDueDate.getDate() - 1); // Move to Saturday
        }
      }
      break;
    case 'yearly':
      // Advance by one year
      nextDueDate.setFullYear(nextDueDate.getFullYear() + 1);
      break;
    default:
      // For 'one-time' tasks or unknown types, there is no next due date to calculate.
      return null;
  }

  return nextDueDate;
};

// --- API Endpoints ---

// Get all tasks with filters
router.get('/', async (req, res) => {
  try {
    const {
      taskType,
      status,
      assignedTo,
      assignedBy,
      priority,
      page = 1,
      limit = 10,
      startDate,
      endDate
    } = req.query;

    const query = { isActive: true };

    // Handle multiple task types (comma-separated)
    if (taskType) {
      if (taskType.includes(',')) {
        query.taskType = { $in: taskType.split(',') };
      } else {
        query.taskType = taskType;
      }
    }
    
    if (status) {
      if (status.includes(',')) {
        query.status = { $in: status.split(',') };
      } else {
        query.status = status;
      }
    }
    
    if (assignedTo) query.assignedTo = assignedTo;
    if (assignedBy) query.assignedBy = assignedBy;
    if (priority) query.priority = priority;

    if (startDate && endDate) {
      query.dueDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const tasks = await Task.find(query)
      .populate('assignedBy', 'username email')
      .populate('assignedTo', 'username email')
      .sort({ dueDate: 1, createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Task.countDocuments(query);

    res.json({
      tasks,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get pending tasks (including one-time and recurring that are overdue or due)
router.get('/pending', async (req, res) => {
  try {
    const { userId, taskType } = req.query;
    const query = {
      isActive: true,
      status: { $in: ['pending', 'overdue'] } // Only show pending or overdue
    };

    if (userId) query.assignedTo = userId; // Filter by assigned user if provided
    if (taskType) query.taskType = taskType; // Filter by task type if provided

    const tasks = await Task.find(query)
      .populate('assignedBy', 'username email')
      .populate('assignedTo', 'username email')
      .sort({ dueDate: 1 }); // Sort by due date ascending

    res.json(tasks);
  } catch (error) {
    console.error('Error fetching pending tasks:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get pending recurring tasks (for the specific "PendingRecurringTasks" frontend component)
router.get('/pending-recurring', async (req, res) => {
  try {
    const { userId } = req.query;
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today to start of day for comparison
    const fiveDaysFromNow = new Date(today);
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);

    const query = {
      isActive: true,
      taskType: { $in: ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'] }, // Include quarterly
      status: { $in: ['pending', 'overdue'] }, // Only pending or overdue
      dueDate: { $lte: fiveDaysFromNow } // Due today or within the next 5 days (or overdue)
    };

    if (userId) query.assignedTo = userId; // Filter by assigned user if provided

    const tasks = await Task.find(query)
      .populate('assignedBy', 'username email')
      .populate('assignedTo', 'username email')
      .sort({ dueDate: 1 }); // Sort by due date ascending

    res.json(tasks);
  } catch (error) {
    console.error('Error fetching pending recurring tasks:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create scheduled tasks (new endpoint for advanced scheduling)
router.post('/create-scheduled', async (req, res) => {
  try {
    const taskData = req.body;
    const createdTasks = [];
    let taskDates = [];

    if (taskData.taskType === 'one-time') {
      // For one-time tasks, just use the provided due date
      taskDates = [new Date(taskData.dueDate)];
    } else {
      // Handle recurring tasks based on start/end dates or forever
      const startDate = new Date(taskData.startDate);
      let endDate;

      if (taskData.isForever) {
        // If forever, set end date based on task type
        endDate = new Date(startDate);
        if (taskData.taskType === 'yearly') {
          // For yearly tasks, use the configured duration
          endDate.setFullYear(endDate.getFullYear() + (taskData.yearlyDuration || 3));
        } else {
          // For daily, weekly, monthly tasks, always use 1 year
          endDate.setFullYear(endDate.getFullYear() + 1);
        }
      } else {
        endDate = new Date(taskData.endDate);
      }

      // Generate task dates based on task type
      switch (taskData.taskType) {
        case 'daily':
          taskDates = getDailyTaskDates(startDate, endDate, taskData.includeSunday);
          break;
        case 'weekly':
          taskDates = getWeeklyTaskDates(startDate, endDate, taskData.weeklyDays);
          break;
        case 'monthly':
          taskDates = getMonthlyTaskDates(startDate, endDate, taskData.monthlyDay || 1, taskData.includeSunday);
          break;
        case 'quarterly':
          // For quarterly tasks, create 4 tasks for one year (no forever option)
          taskDates = getQuarterlyTaskDates(startDate, taskData.includeSunday);
          break;
        case 'yearly':
          // For yearly tasks, use the exact yearlyDuration specified
          if (taskData.isForever) {
            // Use the specified yearlyDuration (3, 5, or 10 years)
            taskDates = getYearlyTaskDates(startDate, taskData.yearlyDuration, taskData.includeSunday);
          } else {
            // Single yearly task
            taskDates = getYearlyTaskDates(startDate, 1, taskData.includeSunday);
          }
          break;
      }
    }

    // Generate a unique task group ID for all related tasks in this series
    const taskGroupId = new Date().getTime().toString() + '-' + Math.random().toString(12).substr(2, 9);

    // Create individual task documents for each generated date
    for (let i = 0; i < taskDates.length; i++) {
      const taskDate = taskDates[i];
      const individualTaskData = {
        title: taskData.title,
        description: taskData.description,
        taskType: taskData.taskType, // Store the original recurring type
        assignedBy: taskData.assignedBy,
        assignedTo: taskData.assignedTo,
        priority: taskData.priority,
        dueDate: taskDate, // Set the specific due date for this instance
        attachments: taskData.attachments || [], // Pass attachments here
        isActive: true,
        status: 'pending', // New tasks are always pending
        taskGroupId: taskGroupId, // Link to the recurring task series
        sequenceNumber: i + 1, // Order within the series
        // Store the full parent task info for calculating subsequent occurrences
        parentTaskInfo: {
          originalStartDate: taskData.startDate,
          originalEndDate: taskData.endDate,
          isForever: taskData.isForever,
          includeSunday: taskData.includeSunday,
          weeklyDays: taskData.weeklyDays,
          monthlyDay: taskData.monthlyDay,
          yearlyDuration: taskData.yearlyDuration
        }
      };

      const task = new Task(individualTaskData);
      await task.save();
      createdTasks.push(task);
    }

    res.status(201).json({
      message: `Successfully created ${createdTasks.length} tasks`,
      tasksCreated: createdTasks.length,
      taskGroupId: taskGroupId,
      tasks: createdTasks.slice(0, 5) // Return first 5 tasks as a sample
    });
  } catch (error) {
    console.error('Error creating scheduled tasks:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create task (original endpoint - kept for backward compatibility for single task creation)
router.post('/', async (req, res) => {
  try {
    const taskData = req.body;
    
    // If 'isForever' is true for a non-scheduled endpoint, set an arbitrary end date
    // This part might need re-evaluation if this endpoint is only for one-time tasks
    // or if scheduled tasks are exclusively created via /create-scheduled
    if (taskData.isForever && taskData.startDate) {
      const oneYearLater = new Date(taskData.startDate);
      oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
      taskData.endDate = oneYearLater;
    }

    const task = new Task({
      ...taskData,
      attachments: taskData.attachments || [] // Pass attachments here
    });
    await task.save();

    const populatedTask = await Task.findById(task._id)
      .populate('assignedBy', 'username email')
      .populate('assignedTo', 'username email');

    res.status(201).json(populatedTask);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update task
router.put('/:id', async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      req.body, // req.body should now correctly include the attachments array if it's being updated
      { new: true } // Return the updated document
    ).populate('assignedBy', 'username email')
     .populate('assignedTo', 'username email');

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Complete task - UPDATED TO HANDLE COMPLETION ATTACHMENTS
router.post('/:id/complete', async (req, res) => {
  try {
    const { completionRemarks, completionAttachments } = req.body;
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // 1. Mark the current task instance as completed
    task.status = 'completed';
    task.completedAt = new Date();
    
    if (completionRemarks && completionRemarks.trim()) {
      task.completionRemarks = completionRemarks.trim();
    }
    
    if (completionAttachments && completionAttachments.length > 0) {
      task.completionAttachments = completionAttachments;
    }
    
    task.lastCompletedDate = new Date(); // Record when this instance was completed

    // 2. REMOVED: Automatic creation of new recurring task instances
    // The original code automatically created new instances here, but we're removing that behavior
    
    console.log(`Task ${task._id} completed - no new recurring instance created`);

    await task.save(); // Save the current task with its updated status and completion info

    const populatedTask = await Task.findById(task._id)
      .populate('assignedBy', 'username email')
      .populate('assignedTo', 'username email');

    res.json(populatedTask); // Respond with the completed task
  } catch (error) {
    console.error('Error completing task:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Revise task
router.post('/:id/revise', async (req, res) => {
  try {
    const { newDate, remarks, revisedBy } = req.body;
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const oldDate = task.dueDate;
    
    // Add revision to history
    task.revisions.push({
      oldDate,
      newDate: new Date(newDate),
      remarks,
      revisedBy
    });

    task.revisionCount += 1;
    task.dueDate = new Date(newDate); // Update the task's due date

    await task.save();

    const populatedTask = await Task.findById(task._id)
      .populate('assignedBy', 'username email')
      .populate('assignedTo', 'username email')
      .populate('revisions.revisedBy', 'username email');

    res.json(populatedTask);
  } catch (error) {
    console.error('Error revising task:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete task (soft delete by setting isActive to false)
router.delete('/:id', async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true } // Return the updated document
    );

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;