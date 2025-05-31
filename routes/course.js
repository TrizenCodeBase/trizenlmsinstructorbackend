import express from 'express';
import Course from '../models/Course.js';
import { authenticate } from './auth.js';
import UserCourse from '../models/UserCourse.js';
import User from '../models/User.js';

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

    // Create and save the course first to get the _id
    const course = new Course(courseData);
    await course.save();

    // Generate TIN prefix with random characters (similar to your example)
    const generateTinSuffix = () => {
      const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      let result = 'TIN';
      for (let i = 0; i < 4; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    // Generate the courseUrl using _id, title and TIN prefix
    const courseId = course._id.toString().slice(-5); // Get last 5 chars of _id
    const titleSlug = course.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const tinSuffix = generateTinSuffix();
    const courseUrl = `${courseId}-${titleSlug}-${tinSuffix}`;

    // Update the course with the generated courseUrl
    course.courseUrl = courseUrl;
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

// Get enrolled users for a course
router.get('/courses/:courseId/enrolled-users', authenticate, async (req, res) => {
  try {
    console.log('Fetching enrolled users for course:', req.params.courseId);
    
    // Verify if the instructor owns this course
    const course = await Course.findOne({
      _id: req.params.courseId,
      instructorId: req.user.id
    });

    if (!course) {
      console.log('Course not found or not authorized:', {
        courseId: req.params.courseId,
        userId: req.user.id
      });
      return res.status(403).json({ message: 'Not authorized to view this course data' });
    }

    // Get all enrollments for the course with populated user data
    const enrollments = await UserCourse.find({ 
      courseId: req.params.courseId 
    }).populate({
      path: 'userId',
      model: 'User',
      select: 'name email avatar'
    }).sort({ enrolledAt: -1 });

    console.log('Found enrollments:', enrollments.length);

    // Format the response
    const enrolledUsers = enrollments.map(enrollment => {
      // Check if userId is populated
      if (!enrollment.userId) {
        console.warn('Enrollment found without user data:', enrollment._id);
        return null;
      }

      return {
        _id: enrollment._id,
        userId: {
          _id: enrollment.userId._id,
          name: enrollment.userId.name,
          email: enrollment.userId.email,
          avatar: enrollment.userId.avatar
        },
        progress: enrollment.progress || 0,
        status: enrollment.status || 'enrolled',
        enrolledAt: enrollment.enrolledAt,
        lastAccessedAt: enrollment.lastAccessedAt || enrollment.enrolledAt,
        completedDays: enrollment.completedDays || []
      };
    }).filter(Boolean); // Remove any null entries

    console.log('Sending response with enrolled users:', enrolledUsers.length);

    res.json({
      courseId: req.params.courseId,
      enrolledUsers
    });
  } catch (error) {
    console.error('Get enrolled users error details:', {
      error: error.message,
      stack: error.stack,
      courseId: req.params.courseId,
      userId: req.user?.id
    });
    res.status(500).json({ 
      message: 'Server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get instructor total enrolled students
router.get('/instructor/total-students', authenticate, async (req, res) => {
  try {
    // First get all courses by this instructor
    const courses = await Course.find({ instructorId: req.user.id });
    const courseIds = courses.map(course => course._id);

    // Get total enrolled students across all instructor's courses with valid user accounts
    const enrollments = await UserCourse.find({
      courseId: { $in: courseIds }
    }).populate('userId', '_id');

    // Only count enrollments where userId exists and is valid
    const totalStudents = enrollments.filter(enrollment => enrollment.userId).length;

    // Get new students enrolled this month with valid accounts
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const newEnrollments = await UserCourse.find({
      courseId: { $in: courseIds },
      enrolledAt: { $gte: startOfMonth }
    }).populate('userId', '_id');

    const newStudentsThisMonth = newEnrollments.filter(enrollment => enrollment.userId).length;

    res.json({
      totalStudents,
      newStudentsThisMonth
    });
  } catch (error) {
    console.error('Get instructor total students error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get instructor course ratings
router.get('/instructor/ratings', authenticate, async (req, res) => {
  try {
    // Get all courses by this instructor
    const courses = await Course.find({ instructorId: req.user.id });
    
    // Calculate average rating
    const coursesWithRatings = courses.filter(course => course.rating);
    const totalRating = coursesWithRatings.reduce((sum, course) => sum + (course.rating || 0), 0);
    const averageRating = coursesWithRatings.length > 0 
      ? Number((totalRating / coursesWithRatings.length).toFixed(1))
      : 0;

    // Calculate rating change from last month
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    lastMonth.setDate(1);
    lastMonth.setHours(0, 0, 0, 0);

    const previousCourses = await Course.find({
      instructorId: req.user.id,
      updatedAt: { $lt: lastMonth }
    });

    const previousCoursesWithRatings = previousCourses.filter(course => course.rating);
    const previousTotalRating = previousCoursesWithRatings.reduce((sum, course) => sum + (course.rating || 0), 0);
    const previousAverageRating = previousCoursesWithRatings.length > 0
      ? Number((previousTotalRating / previousCoursesWithRatings.length).toFixed(1))
      : 0;

    const ratingChange = Number((averageRating - previousAverageRating).toFixed(1));

    res.json({
      averageRating,
      ratingChange,
      totalCourses: courses.length,
      ratedCourses: coursesWithRatings.length
    });
  } catch (error) {
    console.error('Get instructor ratings error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get instructor referral stats
router.get('/instructor/referrals', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    // Get referrals from this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    
    const newReferralsThisMonth = await User.countDocuments({
      referredBy: req.user.id,
      createdAt: { $gte: startOfMonth }
    });

    res.json({
      totalReferrals: user.referralCount || 0,
      newReferralsThisMonth,
      referralCode: user.referralCode || ''
    });
  } catch (error) {
    console.error('Get instructor referrals error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
