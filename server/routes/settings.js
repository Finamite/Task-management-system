import express from 'express';
import Settings from '../models/Settings.js';

const router = express.Router();

// Get task completion settings
router.get('/task-completion', async (req, res) => {
  try {
    let settings = await Settings.findOne({ type: 'taskCompletion' });
    
    if (!settings) {
      // Create default settings if none exist
      settings = new Settings({
        type: 'taskCompletion',
        data: {
          pendingTasks: {
            allowAttachments: false,
            mandatoryAttachments: false,
            mandatoryRemarks: false,
          },
          pendingRecurringTasks: {
            allowAttachments: false,
            mandatoryAttachments: false,
            mandatoryRemarks: false,
          }
        }
      });
      await settings.save();
    }

    res.json(settings.data);
  } catch (error) {
    console.error('Error fetching task completion settings:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Save task completion settings
router.post('/task-completion', async (req, res) => {
  try {
    const settingsData = req.body;

    let settings = await Settings.findOne({ type: 'taskCompletion' });
    
    if (settings) {
      settings.data = settingsData;
      settings.updatedAt = new Date();
    } else {
      settings = new Settings({
        type: 'taskCompletion',
        data: settingsData
      });
    }

    await settings.save();
    res.json({ message: 'Settings saved successfully', data: settings.data });
  } catch (error) {
    console.error('Error saving task completion settings:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

export default router;