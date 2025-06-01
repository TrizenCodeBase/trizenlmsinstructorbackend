import express from 'express';
import Message from '../models/Message.js';
import { authenticate } from './auth.js';
import { isValidObjectId } from 'mongoose';

const router = express.Router();

// Get all conversations for a user
router.get('/messages/conversations', authenticate, async (req, res) => {
  try {
    // Find all unique conversations where user is either sender or receiver
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { senderId: req.user.id },
            { receiverId: req.user.id }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$senderId", req.user.id] },
              "$receiverId",
              "$senderId"
            ]
          },
          courseId: { $first: "$courseId" },
          lastMessage: { $first: "$content" },
          updatedAt: { $first: "$createdAt" },
          unreadCount: {
            $sum: {
              $cond: [
                { 
                  $and: [
                    { $eq: ["$receiverId", req.user.id] },
                    { $eq: ["$read", false] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "partner"
        }
      },
      {
        $lookup: {
          from: "courses",
          localField: "courseId",
          foreignField: "_id",
          as: "course"
        }
      },
      {
        $unwind: "$partner"
      },
      {
        $unwind: "$course"
      },
      {
        $project: {
          _id: 1,
          partner: {
            _id: "$partner._id",
            name: "$partner.name",
            email: "$partner.email"
          },
          course: {
            _id: "$course._id",
            title: "$course.title"
          },
          lastMessage: 1,
          unreadCount: 1,
          updatedAt: 1
        }
      },
      {
        $sort: { updatedAt: -1 }
      }
    ]);

    res.json(conversations);
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ message: 'Failed to get conversations' });
  }
});

// Send a new message
router.post('/messages', authenticate, async (req, res) => {
  try {
    const { receiverId, courseId, content } = req.body;

    // Validate required fields
    if (!receiverId || !courseId || !content) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Validate ObjectIds
    if (!isValidObjectId(receiverId) || !isValidObjectId(courseId)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    // Create the message
    const message = new Message({
      senderId: req.user.id,
      receiverId,
      courseId,
      content: content.trim(),
      read: false
    });

    await message.save();

    // Populate sender and receiver details
    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', 'name email')
      .populate('receiverId', 'name email')
      .populate('courseId', 'title');

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ message: 'Failed to send message' });
  }
});

// Get messages for a conversation
router.get('/messages/:receiverId/:courseId', authenticate, async (req, res) => {
  try {
    const { receiverId, courseId } = req.params;

    // Validate ObjectIds
    if (!isValidObjectId(receiverId) || !isValidObjectId(courseId)) {
      return res.status(400).json({ message: 'Invalid ID format' });
    }

    // Find messages where user is either sender or receiver in this course
    const messages = await Message.find({
      courseId,
      $or: [
        { senderId: req.user.id, receiverId },
        { senderId: receiverId, receiverId: req.user.id }
      ]
    })
    .sort({ createdAt: 1 })
    .populate('senderId', 'name email')
    .populate('receiverId', 'name email')
    .populate('courseId', 'title');

    // Mark messages as read if user is the receiver
    if (messages.length > 0) {
      await Message.updateMany(
        {
          courseId,
          senderId: receiverId,
          receiverId: req.user.id,
          read: false
        },
        { read: true }
      );
    }

    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ message: 'Failed to get messages' });
  }
});

// Get unread message count
router.get('/messages/unread/count', authenticate, async (req, res) => {
  try {
    const count = await Message.countDocuments({
      receiverId: req.user.id,
      read: false
    });

    res.json({ count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ message: 'Failed to get unread count' });
  }
});

export default router; 