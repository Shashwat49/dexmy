import mongoose from "mongoose";

const questionSchema = new mongoose.Schema(
  {
    questionText: {
      type: String,
      trim: true,
      default: "",
    },

    questionImage: {
      type: String,
      default: "",
    },

    options: {
      type: [String],
      required: true,
      validate: {
        validator: function (value) {
          return value.length >= 2 && value.length <= 5;
        },
        message: "A question must have between 2 and 5 options.",
      },
    },

    correctAnswer: {
      type: Number,
      required: true,
      min: 0,
    },

    marks: {
      type: Number,
      default: 1,
    },
    difficulty: {
      type: String,
      enum: ["Easy", "Medium", "Hard"],
      default: "Medium",
    },

    negativeMarks: {
      type: Number,
      default: 0,
    },

    subject: {
      type: String,
      trim: true,
      default: "General Awareness",
    },
  },
  {
    timestamps: true,
  },
);

const Question = mongoose.model("Question", questionSchema);

export default Question;
