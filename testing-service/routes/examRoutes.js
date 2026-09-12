import express from "express";
import authMiddleware, { requireTestCreator } from "../middleware/auth.js";

import {
  createExam,
  getExams,
  getExamById,
  updateExam,
  deleteExam,
  addQuestionToExam,
  removeQuestionFromExam,
  toggleExamPublish,
} from "../controllers/examController.js";

const router = express.Router();

router.use(authMiddleware);
router.use(requireTestCreator);

router.post("/", createExam);

router.get("/", getExams);

router.get("/:id", getExamById);

router.put("/:id", updateExam);

router.delete("/:id", deleteExam);

router.post("/:id/questions", addQuestionToExam);

router.delete("/:id/questions", removeQuestionFromExam);

router.patch("/:id/publish", toggleExamPublish);

export default router;