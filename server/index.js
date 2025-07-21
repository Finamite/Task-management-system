import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';
import dotenv from 'dotenv';

// Import routes
import authRoutes from './routes/auth.js';
import taskRoutes from './routes/tasks.js';
import userRoutes from './routes/users.js';
import dashboardRoutes from './routes/dashboard.js';
import settingsRoutes from './routes/settings.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + extension);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept all file types for now
    cb(null, true);
  }
});

// File upload endpoint
app.post('/api/upload', upload.array('files', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const fileInfo = req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      path: file.path,
      size: file.size,
      uploadedAt: new Date()
    }));

    res.json({ 
      message: 'Files uploaded successfully', 
      files: fileInfo 
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Server error during file upload' });
  }
});

// Serve uploaded files statically
app.use('/uploads', express.static(uploadsDir));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);

// MongoDB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    
    // Check if admin user exists, if not create one
    const User = mongoose.model('User');
    User.findOne({ email: 'admin@taskmanagement.com' })
      .then(existingAdmin => {
        if (!existingAdmin) {
          const admin = new User({
            username: 'admin',
            email: 'admin@taskmanagement.com',
            role: 'admin',
            permissions: {
              canViewTasks: true,
              canViewAllTeamTasks: true,
              canAssignTasks: true,
              canDeleteTasks: true,
              canEditTasks: true,
              canManageUsers: true,
              canEditRecurringTaskSchedules: true
            }
          });
          admin.save().then(() => {
            console.log('Admin user created');
          });
        }
      });
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error:', error);
  });