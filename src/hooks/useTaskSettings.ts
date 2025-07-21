import { useState, useEffect } from 'react';
import axios from 'axios';

interface TaskCompletionSettings {
  pendingTasks: {
    allowAttachments: boolean;
    mandatoryAttachments: boolean;
    mandatoryRemarks: boolean;
  };
  pendingRecurringTasks: {
    allowAttachments: boolean;
    mandatoryAttachments: boolean;
    mandatoryRemarks: boolean;
  };
}

export const useTaskSettings = () => {
  const [settings, setSettings] = useState<TaskCompletionSettings>({
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
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTaskSettings();
  }, []);

  const fetchTaskSettings = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/settings/task-completion');
      if (response.data) {
        setSettings(response.data);
      }
    } catch (error) {
      console.error('Error fetching task settings:', error);
    } finally {
      setLoading(false);
    }
  };

  return { settings, loading, refetch: fetchTaskSettings };
};