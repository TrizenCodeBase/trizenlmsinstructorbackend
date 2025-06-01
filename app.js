import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import courseRoutes from './routes/course.js';
import messageRoutes from './routes/message.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://instructor.lms.trizenventures.com'
    : ['http://localhost:5173', 'https://instructor.lms.trizenventures.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Routes
app.use('/api', authRoutes);
app.use('/api', courseRoutes);
app.use('/api', messageRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something broke!' });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI )
// || 'mongodb+srv://user:user@cluster0.jofrcro.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0'
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const PORT = 3000; // Set port to match frontend's expected port
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
}); 