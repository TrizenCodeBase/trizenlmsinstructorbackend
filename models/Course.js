import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  studentName: { type: String, required: true },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const lessonSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  videoUrl: { type: String },
  duration: { type: Number }, // in minutes
  resources: [{ type: String }]
});

const moduleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  lessons: [lessonSchema]
});

const mcqOptionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  isCorrect: { type: Boolean, required: true }
});

const mcqQuestionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: [mcqOptionSchema],
  explanation: { type: String }
});

const roadmapDaySchema = new mongoose.Schema({
  day: { type: Number, required: true },
  topics: { type: String, required: true },
  video: { type: String, required: true },
  transcript: { type: String },
  notes: { type: String },
  mcqs: [mcqQuestionSchema] // Add MCQ questions to each day
});

const courseSchema = new mongoose.Schema({
  image: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  longDescription: { type: String },
  instructor: { type: String, required: true },
  instructorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  duration: { type: String, required: true },
  rating: { type: Number, required: true },
  students: { type: Number, default: 0 },
  level: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Advanced', 'Beginner to Intermediate'],
    required: true
  },
  category: { type: String, required: true },
  language: {
    type: String,
    enum: ['English', 'Hindi', 'Tamil', 'Telugu', 'Malayalam', 'Kannada', 'Bengali', 'Marathi', 'Gujarati', 'Punjabi'],
    required: true
  },
  skills: [{ type: String }],
  courses: [{
    title: { type: String },
    details: { type: String }
  }],
  testimonials: [{
    text: { type: String },
    author: { type: String },
    since: { type: String }
  }],
  modules: [moduleSchema],
  reviews: [reviewSchema],
  roadmap: [roadmapDaySchema],
  courseAccess: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const Course = mongoose.model('Course', courseSchema);

export default Course;
