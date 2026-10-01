import express from "express";
import authMiddleware, { requireTestCreator, requireStudent } from "../middleware/auth.js";

import {
    createQuestionReport,
    getQuestionReports,
    getQuestionReportById,
    updateQuestionReportStatus,
} from "../controllers/questionReportController.js";

const router = express.Router();


// Submit report
router.post("/", authMiddleware, requireStudent, createQuestionReport);


// Get all reports
router.get("/", authMiddleware, requireTestCreator, getQuestionReports);


// Get single report
router.get("/:id", authMiddleware, requireTestCreator, getQuestionReportById);


// Update report status
router.patch("/:id/status", authMiddleware, requireTestCreator, updateQuestionReportStatus);


export default router;