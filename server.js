import express from 'express';
import morgan from 'morgan';
import multer from 'multer';
import dotenv from 'dotenv';
import videoRouter from './routes/video.js';
import authRouter from './routes/auth.js';
import courseRouter from './routes/course.js';
import messageRouter from './routes/message.js';
import path from 'path';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import bcrypt from 'bcrypt';
import User from './models/User.js'; // Make sure this path is correct
import axios from 'axios';
import crypto from 'crypto';
import discussionRoutes from './routes/discussion.js';

// Load environment variables
dotenv.config();

const app = express();

// CORS Configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Apply CORS middleware before any routes
app.use(cors(corsOptions));

// Handle OPTIONS preflight requests
app.options('*', cors(corsOptions));

// Connect to MongoDB with improved error handling
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URL || 'mongodb://localhost:27017/chunked-video-vault');
    console.log('MongoDB connected successfully');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    // Exit process with failure
    process.exit(1);
  }
};

// Call the connect function
connectDB();

// Parse JSON bodies
app.use(express.json({
  limit: '1000MB',
}));

app.use(morgan('dev'));

// Authentication middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ message: 'Invalid token' });
  }
};

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

// User Profile Routes
// Get user data
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    // User is already fetched and validated in the authenticateToken middleware
    res.json(req.user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update user profile settings
app.put('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    console.log('Received profile update request:', req.body);
    
    const { 
      name, 
      displayName, 
      bio, 
      email,
      instructorProfile 
    } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      console.error('User not found:', req.user.id);
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('Current user data:', user);
    
    // If email is being changed, check if it's already in use
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }
    
    // Create update object with all fields that should be updated
    const updateFields = {};

    // Update basic fields - using direct assignment to ensure null/empty values are saved
    if (name !== undefined) updateFields.name = name;
    if (displayName !== undefined) updateFields.displayName = displayName;
    if (bio !== undefined) updateFields.bio = bio;
    if (email !== undefined) updateFields.email = email;

    // Update instructor profile if user is an instructor
    if (instructorProfile && user.role === 'instructor') {
      updateFields.instructorProfile = {
        ...user.instructorProfile || {},
        ...instructorProfile,
        specialty: instructorProfile.specialty || user.instructorProfile?.specialty || '',
        experience: Number(instructorProfile.experience) || user.instructorProfile?.experience || 0,
        phone: instructorProfile.phone || user.instructorProfile?.phone || '',
        location: instructorProfile.location || user.instructorProfile?.location || '',
        socialLinks: {
          ...(user.instructorProfile?.socialLinks || {}),
          ...(instructorProfile.socialLinks || {})
        },
        rating: instructorProfile.rating ?? user.instructorProfile?.rating ?? 0,
        totalReviews: instructorProfile.totalReviews ?? user.instructorProfile?.totalReviews ?? 0,
        courses: instructorProfile.courses ?? user.instructorProfile?.courses ?? [],
        teachingHours: instructorProfile.teachingHours ?? user.instructorProfile?.teachingHours ?? 0
      };
    }

    console.log('Final update fields:', updateFields);

    // Update the user with all changes at once
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $set: updateFields },
      { 
        new: true, 
        runValidators: true,
        upsert: false
      }
    ).lean();

    if (!updatedUser) {
      console.error('Failed to update user');
      return res.status(404).json({ message: 'Failed to update user' });
    }

    console.log('Updated user data:', updatedUser);

    // Return the updated user data
    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        displayName: updatedUser.displayName,
        email: updatedUser.email,
        bio: updatedUser.bio || '',
        role: updatedUser.role,
        instructorProfile: updatedUser.role === 'instructor' ? {
          ...updatedUser.instructorProfile,
          phone: updatedUser.instructorProfile?.phone || '',
          location: updatedUser.instructorProfile?.location || '',
          socialLinks: updatedUser.instructorProfile?.socialLinks || {}
        } : undefined
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: error.message,
      stack: error.stack
    });
  }
});

// Update user password
app.put('/api/user/password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    user.password = hashedPassword;
    
    await user.save();
    
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// API routes
app.use('/api/auth', authRouter);
app.use('/api', courseRouter);
app.use('/api', messageRouter);
app.use('/api', videoRouter);
app.use('/api', discussionRoutes);

const port = process.env.PORT || 5001;
app.listen(port, () => {
  console.log(`app running on port: ${port}`);
});
// Instructor Message Routes

// Get all conversations for instructor
app.get('/api/instructor/conversations', authenticateToken, async (req, res) => {
  try {
    // Verify user is an instructor
    if (req.user.role !== 'instructor') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get all courses where user is instructor
    const courses = await Course.find({ instructorId: req.user.id });
    
    // Get all enrollments for these courses
    const enrollments = await UserCourse.find({
      courseId: { $in: courses.map(c => c._id) },
      status: { $in: ['enrolled', 'started', 'completed'] }
    }).populate('userId', 'name email');

    // Get latest message for each student
    const conversations = await Promise.all(
      enrollments.map(async enrollment => {
        const latestMessage = await Message.findOne({
          $or: [
            { senderId: req.user.id, receiverId: enrollment.userId._id },
            { senderId: enrollment.userId._id, receiverId: req.user.id }
          ],
          courseId: enrollment.courseId
        })
        .sort({ createdAt: -1 })
        .populate('courseId', 'title');

        return {
          student: enrollment.userId,
          course: enrollment.courseId,
          lastMessage: latestMessage
        };
      })
    );

    res.json(conversations.filter(c => c.lastMessage));
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get messages between instructor and student for a course
app.get('/api/instructor/messages/:studentId/:courseId', authenticateToken, async (req, res) => {
  try {
    const { studentId, courseId } = req.params;

    // Verify instructor owns the course
    const course = await Course.findOne({
      _id: courseId,
      instructorId: req.user.id
    });
    
    if (!course) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Get messages
    const messages = await Message.find({
      courseId,
      $or: [
        { senderId: req.user.id, receiverId: studentId },
        { senderId: studentId, receiverId: req.user.id }
      ]
    })
    .sort({ createdAt: 1 })
    .populate('senderId', 'name role')
    .populate('receiverId', 'name role');

    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Instructor sends message to student
app.post('/api/instructor/messages', authenticateToken, async (req, res) => {
  try {
    const { studentId, courseId, content } = req.body;

    // Verify instructor owns the course
    const course = await Course.findOne({
      _id: courseId,
      instructorId: req.user.id
    });
    
    if (!course) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Verify student is enrolled
    const enrollment = await UserCourse.findOne({
      userId: studentId,
      courseId,
      status: { $in: ['enrolled', 'started', 'completed'] }
    });

    if (!enrollment) {
      return res.status(400).json({ message: 'Student not enrolled' });
    }

    // Create message
    const message = new Message({
      senderId: req.user.id,
      receiverId: studentId,
      courseId,
      content,
      read: false
    });

    await message.save();

    // Here you would need to notify the student's server
    // This would require an HTTP call to the student/admin server
    // You'll need to implement this cross-server communication

    res.status(201).json(message);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});


// Generate a shared secret (store in .env of both servers)
const INTER_SERVER_SECRET = process.env.INTER_SERVER_SECRET;

// Webhook to receive notifications
app.post('/api/messages/notify', async (req, res) => {
  try {
    // 1. Verify the request is from our other server
    const signature = req.headers['x-signature'];
    const expectedSignature = crypto
      .createHmac('sha256', INTER_SERVER_SECRET)
      .update(JSON.stringify(req.body))
      .digest('hex');
    
    if (signature !== expectedSignature) {
      return res.status(403).json({ message: 'Invalid signature' });
    }

    // 2. Process the notification
    const { messageId } = req.body;
    const message = await Message.findById(messageId)
      .populate('senderId', 'name')
      .populate('courseId', 'title');

    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // 3. Create a notification for the recipient
    const notification = new Notification({
      userId: message.receiverId,
      type: 'message',
      title: `New message from ${message.senderId.name}`,
      message: `New message in ${message.courseId.title}`,
      relatedId: message._id,
      read: false
    });

    await notification.save();

    // 4. Emit real-time event if using Socket.IO
    // io.to(`user_${message.receiverId}`).emit('new_message', message);

    res.json({ success: true });
  } catch (error) {
    console.error('Notification error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});