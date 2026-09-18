import mongoose from "mongoose";

const questionReportSchema = new mongoose.Schema(
    {
        examId: {
            type: String,
            required: true,
        },

        questionId: {
            type: String,
            required: true,
        },

        examTitle: {
            type: String,
            default: "",
        },

        questionText: {
            type: String,
            default: "",
        },

        reason: {
            type: String,
            required: true,
        },

        description: {
            type: String,
            default: "",
        },

        status: {
            type: String,
            enum: ["pending", "reviewed", "resolved"],
            default: "pending",
        },
    },
    {
        timestamps: true,
    }
);

const QuestionReport = mongoose.model(
    "QuestionReport",
    questionReportSchema
);

export default QuestionReport;