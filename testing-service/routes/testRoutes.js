import express from "express";
import multer from "multer";
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
import { importPdfQuestions } from "../controllers/pdfTestImportController.js";

const router = express.Router();
const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const hasPdfExtension = /\.pdf$/i.test(file.originalname || "");
    const isPdfMime = file.mimetype === "application/pdf" || file.mimetype === "application/octet-stream";
    if (!hasPdfExtension || !isPdfMime) {
      return callback(new Error("Please upload a PDF file."));
    }
    callback(null, true);
  },
});

router.post("/import-pdf", authMiddleware, requireTestCreator, pdfUpload.single("pdf"), importPdfQuestions);
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
