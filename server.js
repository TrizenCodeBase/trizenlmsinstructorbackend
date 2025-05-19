
import express from 'express';
import morgan from 'morgan';
import multer from 'multer';
import dotenv from 'dotenv';
import videoRouter from './routes/video.js';
import authRouter from './routes/auth.js';
import courseRouter from './routes/course.js';
import path from 'path';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
const cors = require('cors');

// Load environment variables
dotenv.config();
 const corsOptions = {
    origin: 'https://instructor.lms.trizenventures.com',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
// Connect to MongoDB with improved error handling
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL);
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    // Exit process with failure
    process.exit(1);
  }
};

// Call the connect function
connectDB();

const app = express();

app.use(express.json({
  limit: '1000MB',
}));

// Enable CORS for all routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

app.use(cors());
app.use(morgan('dev'));

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).send('File size limit exceeded (max 1000MB).');
    }
  }
  console.error('Server error:', err.stack);
  res.status(500).send(err.message);
});

app.use(express.static('public'));

// Route for the home page
app.get('/', (req, res) => {
  res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api', videoRouter);
app.use('/api', courseRouter);

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`app running on port: ${port}`);
});
