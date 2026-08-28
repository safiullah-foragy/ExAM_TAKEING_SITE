const mongoose = require('mongoose');

const answerKeySchema = new mongoose.Schema(
  {
    questionNo: { type: Number, required: true },
    answer: { type: String, required: true }, // 'ক', 'খ', 'গ', 'ঘ'
  },
  { _id: false }
);

const examSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Exam title is required'],
      trim: true,
    },
    author: {
      type: String,
      required: [true, 'Author is required'],
      trim: true,
    },
    totalTime: {
      type: Number,
      required: [true, 'Total time is required'],
      min: 1, // in minutes
    },
    totalMarks: {
      type: Number,
      required: [true, 'Total marks is required'],
      min: 1,
    },
    passMarks: {
      type: Number,
      required: [true, 'Pass marks is required'],
      min: 0,
    },
    marksPerMCQ: {
      type: Number,
      default: 1,
      min: 0.25,
    },
    negativeMark: {
      type: Number,
      default: 0, // deduction per wrong answer
      min: 0,
    },
    pdfPath: {
      type: String,
      required: [true, 'Question PDF is required'],
    },
    pdfOriginalName: {
      type: String,
    },
    totalQuestions: {
      type: Number,
      default: 0,
    },
    answerKey: [answerKeySchema], // parsed from CSV
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Exam', examSchema);
