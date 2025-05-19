
import mongoose from 'mongoose';

const mcqOptionSchema = new mongoose.Schema({
  text: String,
  isCorrect: Boolean
});

const mcqQuestionSchema = new mongoose.Schema({
  question: String,
  options: [mcqOptionSchema]
});

const roadmapDaySchema = new mongoose.Schema({
  day: Number,
  topics: String,
  video: String,
  transcript: String,
  notes: String,
  mcqs: [mcqQuestionSchema],
  code: String,
  language: String
});

const reviewSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rating: Number,
  comment: String,
  date: {
    type: Date,
    default: Date.now
  }
});

const CourseSchema = new mongoose.Schema({
  image: {
    type: String,
    default: 'https://placehold.co/600x400'
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  longDescription: String,
  instructor: {
    type: String,
    required: true
  },
  instructorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  duration: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    default: 0
  },
  students: {
    type: Number,
    default: 0
  },
  level: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced'],
    required: true
  },
  category: {
    type: String,
    required: true
  },
  skills: [String],
  modules: [String],
  reviews: [reviewSchema],
  roadmap: [roadmapDaySchema],
  courseAccess: {
    type: Boolean,
    default: true
  },
  courses: {
    type: Array,
    default: []
  },
  testimonials: {
    type: Array,
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Course = mongoose.model('Course', CourseSchema);

export default Course;
