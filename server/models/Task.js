import mongoose from 'mongoose';

const revisionSchema = new mongoose.Schema({
  oldDate: Date,
  newDate: Date,
  remarks: String,
  revisedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  revisedAt: {
    type: Date,
    default: Date.now
  }
});

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  taskType: {
    type: String,
    enum: ['one-time', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly'],
    required: true
  },
  originalTaskType: {
    type: String,
    enum: ['one-time', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly']
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  dueDate: {
    type: Date,
    required: true
  },
  originalStartDate: Date, // For tracking original date range
  originalEndDate: Date,   // For tracking original date range
  weeklyDays: [Number],    // For weekly tasks - which days of week
  monthlyDay: {            // For monthly tasks - which day of month (1-31)
    type: Number,
    min: 1,
    max: 31
  },
  priority: {
    type: String,
    enum: ['normal', 'high'],
    default: 'normal'
  },
  status: {
    type: String,
    enum: ['pending', 'in-progress', 'completed', 'overdue'],
    default: 'pending'
  },
  completedAt: Date,
  completionRemarks: String,
  completionAttachments: [{
    filename: String,
    originalName: String,
    path: String,
    size: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  attachments: [{
    filename: String,
    originalName: String,
    path: String,
    size: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  revisions: [revisionSchema],
  revisionCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Group related tasks together
  taskGroupId: String,
  sequenceNumber: Number, // For ordering tasks in a group
  scheduledDate: Date,    // When this task was originally scheduled for
  parentTaskInfo: {       // Information about the original recurring task
    originalStartDate: Date,
    originalEndDate: Date,
    isForever: Boolean,
    includeSunday: Boolean,
    weeklyDays: [Number],
    monthlyDay: Number,
    yearlyDuration: Number
  }
}, {
  timestamps: true
});

// Index for better query performance
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ taskType: 1, status: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ taskGroupId: 1 });
taskSchema.index({ originalTaskType: 1 });

export default mongoose.model('Task', taskSchema);