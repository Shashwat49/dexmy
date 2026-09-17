import express from "express";
import authMiddleware, { requireTestCreator, requireStudent } from "../middleware/auth.js";
import {
  createTest,
  getTests,
  getTestById,
  updateTest,
  deleteTest,
  toggleTestPublish,
  addQuestionToTest,
  removeQuestionFromTest,
  getPublishedTests,
  purchaseTest,
  getMyPurchases,
} from "../controllers/testController.js";

const router = express.Router();

router.post("/", authMiddleware, requireTestCreator, createTest);
router.get("/", authMiddleware, requireTestCreator, getTests);
router.get("/published", authMiddleware, requireStudent, getPublishedTests);
router.get("/my-purchases", authMiddleware, getMyPurchases);
router.get("/:id", authMiddleware, getTestById);
router.put("/:id", authMiddleware, requireTestCreator, updateTest);
router.delete("/:id", authMiddleware, requireTestCreator, deleteTest);
router.patch("/:id/publish", authMiddleware, requireTestCreator, toggleTestPublish);
router.patch("/:id/unpublish", authMiddleware, requireTestCreator, toggleTestPublish);
router.post("/:id/questions", authMiddleware, requireTestCreator, addQuestionToTest);
router.delete("/:id/questions", authMiddleware, requireTestCreator, removeQuestionFromTest);
router.post("/:id/purchase", authMiddleware, purchaseTest);

export default router;
