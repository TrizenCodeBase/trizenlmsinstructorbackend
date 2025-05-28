import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 5000
  },
  read: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add indexes for better query performance
messageSchema.index({ senderId: 1, receiverId: 1 });
messageSchema.index({ courseId: 1 });
messageSchema.index({ createdAt: -1 });

// Add validation to ensure message content is not empty
messageSchema.pre('save', function(next) {
  if (this.content.trim().length === 0) {
    next(new Error('Message content cannot be empty'));
  }
  next();
});

const Message = mongoose.model('Message', messageSchema);

export default Message; 