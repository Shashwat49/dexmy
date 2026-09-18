import express from "express";
import authMiddleware, { requireTestCreator } from "../middleware/auth.js";

import {
  createQuestion,
  getQuestions,
  getQuestionById,
  updateQuestion,
  deleteQuestion,
} from "../controllers/questionController.js";

const router = express.Router();

router.use(authMiddleware);
router.use(requireTestCreator);

router.post("/", createQuestion);

router.get("/", getQuestions);

router.get("/:id", getQuestionById);

router.put("/:id", updateQuestion);

router.delete("/:id", deleteQuestion);

export default router;