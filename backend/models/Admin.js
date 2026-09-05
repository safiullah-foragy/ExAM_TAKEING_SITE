const mongoose = require('mongoose');

const adminSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      default: 'Exam Authority',
      trim: true,
    },
    title: {
      type: String,
      default: 'Head Administrator',
      trim: true,
    },
    photo: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Admin', adminSchema);
