const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema(
  {
    questionNo: { type: Number, required: true },
    selectedAnswer: { type: String, default: null }, // 'ক', 'খ', 'গ', 'ঘ' or null if skipped
  },
  { _id: false }
);

const submissionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Exam',
      required: true,
    },
    answers: [answerSchema],
    score: {
      type: Number,
      default: 0,
    },
    totalAttempted: {
      type: Number,
      default: 0,
    },
    correct: {
      type: Number,
      default: 0,
    },
    wrong: {
      type: Number,
      default: 0,
    },
    skipped: {
      type: Number,
      default: 0,
    },
    passed: {
      type: Boolean,
      default: false,
    },
    timeTaken: {
      type: Number, // seconds
      default: 0,
    },
    resultPdfPath: {
      type: String,
      default: null,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    // Explicit 1st attempt snapshot (main evaluation is always 1st exam)
    firstAnswers: [answerSchema],
    firstScore: { type: Number },
    firstCorrect: { type: Number },
    firstWrong: { type: Number },
    firstSkipped: { type: Number },
    firstPassed: { type: Boolean },
    firstSubmittedAt: { type: Date },
    firstTimeTaken: { type: Number },

    // Practice / retake tracking
    retakeCount: { type: Number, default: 0 },
    lastPracticeScore: { type: Number },
    lastPracticeAnswers: [answerSchema],
    lastPracticeSubmittedAt: { type: Date },
  },
  { timestamps: true }
);

// Prevent duplicate submissions
submissionSchema.index({ userId: 1, examId: 1 }, { unique: true });

module.exports = mongoose.model('Submission', submissionSchema);
