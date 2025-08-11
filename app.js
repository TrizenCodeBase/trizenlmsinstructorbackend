import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import authRoutes from './routes/auth.js';
import courseRoutes from './routes/course.js';
import messageRoutes from './routes/message.js';
import UserCourse from './models/UserCourse.js';

dotenv.config();

const app = express();

// Configure multer for handling file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Make sure this directory exists
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 5000 // 5000 MB limit
  }
});

// Enhanced CORS configuration
app.use(cors({
  origin: 'http://localhost:8080/',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Content-Range',
    'Content-Disposition'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400 // 24 hours
}));

// Increased payload limits
app.use(express.json({ limit: '5000mb' }));
app.use(express.urlencoded({ extended: true, limit: '5000mb' }));

// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api', authRoutes);
app.use('/api', courseRoutes);
app.use('/api', messageRoutes);

app.get('/getcourselist/user', (req, res) => {
  UserId = db.iterate('users').find(req.user).userId;
  console.log(UserId);
  UserCourses = db.iterate('usercourses').find(UserId).courseUrl;
  console.log(UserCourses);
  UserCourseTitles = db.iterate('courses').find(UserCourses).title;
  console.log(UserCourseTitles);
});

app.get('/getapi', (req, res) => {
  console.log("hello");
  res.send("hello");
});

// File upload route
app.post('/api/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    res.json({
      message: 'File uploaded successfully',
      filename: req.file.filename,
      path: `/uploads/${req.file.filename}`
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Error uploading file' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message: 'File size limit exceeded (max 5000MB)',
        error: err.message
      });
    }
    return res.status(400).json({
      message: 'File upload error',
      error: err.message
    });
  }
  
  res.status(500).json({
    message: 'Internal server error',
    error: err.message
  });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 