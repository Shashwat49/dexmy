import express from "express";
import authMiddleware, { requireStudent } from "../middleware/auth.js";

import {
  submitTest,
  getSubmissionById,
  getStudentSubmissions,
} from "../controllers/testSubmissionController.js";

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Submissions
 *   description: Student Test Submissions and Results
 */

/**
 * @swagger
 * /api/test-submissions:
 *   post:
 *     summary: Submit a completed test attempt
 *     tags: [Submissions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - testId
 *               - answers
 *             properties:
 *               testId:
 *                 type: string
 *                 example: "11111111-1111-1111-1111-111111111111"
 *               answers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     questionId:
 *                       type: string
 *                     selectedAnswer:
 *                       type: number
 *     responses:
 *       201:
 *         description: Test submitted and scored successfully
 *       400:
 *         description: Invalid test submission data
 */
router.post("/", authMiddleware, requireStudent, submitTest);

/**
 * @swagger
 * /api/test-submissions/my-submissions:
 *   get:
 *     summary: Get all submissions for authenticated student
 *     tags: [Submissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of student submissions
 */
router.get("/my-submissions", authMiddleware, requireStudent, getStudentSubmissions);

/**
 * @swagger
 * /api/test-submissions/student/{studentId}:
 *   get:
 *     summary: Get submissions by student ID
 *     tags: [Submissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Submissions for specific student
 */
router.get("/student/:studentId", authMiddleware, getStudentSubmissions);

/**
 * @swagger
 * /api/test-submissions/{id}:
 *   get:
 *     summary: Get submission scorecard and answers by submission ID
 *     tags: [Submissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Submission scorecard and breakdown
 *       404:
 *         description: Submission not found
 */
router.get("/:id", authMiddleware, getSubmissionById);

export default router;