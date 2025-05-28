import express from 'express';
import Course from '../models/Course.js';
import { authenticate } from './auth.js';

const router = express.Router();

// Create a new course (protected - only for instructors)
router.post('/courses', authenticate, async (req, res) => {
  try {
    // Check if user is an instructor
    if (!req.user || req.user.role !== 'instructor') {
      console.error('Unauthorized attempt to create course:', { user: req.user });
      return res.status(403).json({ message: 'Only instructors can create courses' });
    }

    // Log the incoming request data
    console.log('Creating course with data:', {
      ...req.body,
      instructorId: req.user.id
    });

    // Create new course with instructor ID from authenticated user
    const courseData = {
      ...req.body,
      instructorId: req.user.id
    };

    // Validate required fields
    const requiredFields = [
      'title',
      'description',
      'instructor',
      'duration',
      'level',
      'category',
      'language',
      'image',
      'roadmap'
    ];

    const missingFields = requiredFields.filter(field => !courseData[field]);
    if (missingFields.length > 0) {
      console.error('Missing required fields:', missingFields);
      return res.status(400).json({ 
        message: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    // Validate roadmap data
    if (!Array.isArray(courseData.roadmap) || courseData.roadmap.length === 0) {
      console.error('Invalid roadmap data:', courseData.roadmap);
      return res.status(400).json({ 
        message: 'Course roadmap is required and must have at least one day'
      });
    }

    // Create and save the course
    const course = new Course(courseData);
    await course.save();

    console.log('Course created successfully:', course._id);

    res.status(201).json({
      message: 'Course created successfully',
      course
    });
  } catch (error) {
    console.error('Course creation error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation error',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    res.status(500).json({ 
      message: 'Failed to create course',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get all courses
router.get('/courses', async (req, res) => {
  try {
    const courses = await Course.find().sort({ createdAt: -1 });
    res.json(courses);
  } catch (error) {
    console.error('Get courses error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get instructor courses
router.get('/instructor/courses', authenticate, async (req, res) => {
  try {
    const courses = await Course.find({ instructorId: req.user.id }).sort({ createdAt: -1 });
    res.json(courses);
  } catch (error) {
    console.error('Get instructor courses error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a specific course
router.get('/courses/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    
    res.json(course);
  } catch (error) {
    console.error('Get course error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a course (protected - only for course instructor)
router.put('/courses/:id', authenticate, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    
    // Check if user is the course instructor
    if (course.instructorId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You can only update your own courses' });
    }
    
    const updatedCourse = await Course.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    
    res.json({
      message: 'Course updated successfully',
      course: updatedCourse
    });
  } catch (error) {
    console.error('Update course error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a course (protected - only for course instructor)
router.delete('/courses/:id', authenticate, async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }
    
    // Check if user is the course instructor
    if (course.instructorId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'You can only delete your own courses' });
    }
    
    await Course.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Course deleted successfully' });
  } catch (error) {
    console.error('Delete course error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Check if course title is available
router.get('/courses/check-title/:title', async (req, res) => {
  try {
    const title = req.params.title;
    const existingCourse = await Course.findOne({ title });
    res.json({ available: !existingCourse });
  } catch (error) {
    console.error('Title check error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
