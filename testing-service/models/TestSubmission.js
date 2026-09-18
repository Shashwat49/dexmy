import mongoose from "mongoose";

const testSubmissionSchema = new mongoose.Schema(
  {
    test: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Test",
      required: true,
    },

    answers: [
      {
        question: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Question",
          required: true,
        },

        selectedAnswer: {
          type: Number,
          default: null,
        },

        isCorrect: {
          type: Boolean,
          default: false,
        },

        marksObtained: {
          type: Number,
          default: 0,
        },
      },
    ],

    totalQuestions: {
      type: Number,
      default: 0,
    },

    answered: {
      type: Number,
      default: 0,
    },

    correct: {
      type: Number,
      default: 0,
    },

    incorrect: {
      type: Number,
      default: 0,
    },

    notAnswered: {
      type: Number,
      default: 0,
    },

    totalMarks: {
      type: Number,
      default: 0,
    },

    obtainedMarks: {
      type: Number,
      default: 0,
    },

    percentage: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const TestSubmission = mongoose.model(
  "TestSubmission",
  testSubmissionSchema
);

export default TestSubmission;