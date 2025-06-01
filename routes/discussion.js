import express from 'express';
import { authenticate } from './auth.js';
import Discussion from '../models/Discussion.js';
import { isValidObjectId } from 'mongoose';

const router = express.Router();

// Get all discussions for an instructor
router.get('/discussions/instructor', authenticate, async (req, res) => {
  try {
    const discussions = await Discussion.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .populate('userId', 'name role')
      .populate('courseId', 'title');

    res.json(discussions);
  } catch (error) {
    console.error('Get instructor discussions error:', error);
    res.status(500).json({ message: 'Failed to get discussions' });
  }
});

// Get all discussions for a course
router.get('/discussions/:courseId', authenticate, async (req, res) => {
  try {
    const { courseId } = req.params;
    
    if (!isValidObjectId(courseId)) {
      return res.status(400).json({ message: 'Invalid course ID' });
    }

    const discussions = await Discussion.find({ courseId })
      .sort({ isPinned: -1, createdAt: -1 })
      .populate('userId', 'name role')
      .populate('courseId', 'title')
      .populate('replies.userId', 'name role');

    res.json(discussions);
  } catch (error) {
    console.error('Get discussions error:', error);
    res.status(500).json({ message: 'Failed to get discussions' });
  }
});

// Create a new discussion
router.post('/discussions', authenticate, async (req, res) => {
  try {
    const { courseId, title, content, isPinned = false } = req.body;

    if (!courseId || !title || !content) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (!isValidObjectId(courseId)) {
      return res.status(400).json({ message: 'Invalid course ID' });
    }

    const discussion = new Discussion({
      courseId,
      userId: req.user.id,
      title,
      content,
      isPinned,
      likes: [],
      replies: []
    });

    await discussion.save();

    const populatedDiscussion = await Discussion.findById(discussion._id)
      .populate('userId', 'name')
      .populate('courseId', 'title');

    res.status(201).json(populatedDiscussion);
  } catch (error) {
    console.error('Create discussion error:', error);
    res.status(500).json({ message: 'Failed to create discussion' });
  }
});

// Add a reply to a discussion
router.post('/discussions/:discussionId/replies', authenticate, async (req, res) => {
  try {
    const { discussionId } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ message: 'Reply content is required' });
    }

    if (!isValidObjectId(discussionId)) {
      return res.status(400).json({ message: 'Invalid discussion ID' });
    }

    const discussion = await Discussion.findById(discussionId);
    if (!discussion) {
      return res.status(404).json({ message: 'Discussion not found' });
    }

    discussion.replies.push({
      userId: req.user.id,
      content,
      createdAt: new Date()
    });

    await discussion.save();

    const updatedDiscussion = await Discussion.findById(discussionId)
      .populate('userId', 'name')
      .populate('courseId', 'title')
      .populate('replies.userId', 'name');

    res.json(updatedDiscussion);
  } catch (error) {
    console.error('Add reply error:', error);
    res.status(500).json({ message: 'Failed to add reply' });
  }
});

// Delete a discussion
router.delete('/discussions/:discussionId', authenticate, async (req, res) => {
  try {
    const { discussionId } = req.params;

    if (!isValidObjectId(discussionId)) {
      return res.status(400).json({ message: 'Invalid discussion ID' });
    }

    // Find the discussion and populate necessary fields
    const discussion = await Discussion.findById(discussionId);

    if (!discussion) {
      return res.status(404).json({ message: 'Discussion not found' });
    }

    // Log the values for debugging
    console.log('User ID:', req.user.id);
    console.log('Discussion User ID:', discussion.userId.toString());
    console.log('User Role:', req.user.role);

    // Check if user is the discussion creator or an instructor
    const isCreator = discussion.userId.toString() === req.user.id;
    const isInstructor = req.user.role === 'instructor';

    if (!isCreator && !isInstructor) {
      return res.status(403).json({ 
        message: 'You do not have permission to delete this discussion',
        debug: {
          userId: req.user.id,
          discussionUserId: discussion.userId.toString(),
          userRole: req.user.role,
          isCreator,
          isInstructor
        }
      });
    }

    // Delete the discussion
    await discussion.deleteOne();

    res.json({ 
      message: 'Discussion deleted successfully',
      discussionId: discussion._id 
    });
  } catch (error) {
    console.error('Delete discussion error:', error);
    res.status(500).json({ 
      message: 'Failed to delete discussion',
      error: error.message 
    });
  }
});

export default router; 