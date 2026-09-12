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

/**
 * @swagger
 * tags:
 *   name: Tests
 *   description: Test Creation and Student Test-Taking Endpoints
 */

/**
 * @swagger
 * /api/tests:
 *   post:
 *     summary: Create a new test
 *     tags: [Tests]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - duration
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Quantitative Aptitude Mock Test"
 *               description:
 *                 type: string
 *                 example: "Practice exam for aptitude and logic"
 *               subject:
 *                 type: string
 *                 example: "Mathematics"
 *               duration:
 *                 type: number
 *                 description: "Duration in minutes"
 *                 example: 30
 *               marksPerQuestion:
 *                 type: number
 *                 example: 2
 *               negativeMarks:
 *                 type: number
 *                 example: 0.5
 *               isPaid:
 *                 type: boolean
 *                 example: false
 *               price:
 *                 type: number
 *                 example: 0
 *     responses:
 *       201:
 *         description: Test created successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Test Creator or Admin role required
 */
router.post("/", authMiddleware, requireTestCreator, createTest);

/**
 * @swagger
 * /api/tests:
 *   get:
 *     summary: Get all tests (Test Creator / Admin)
 *     tags: [Tests]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all tests
 */
router.get("/", authMiddleware, requireTestCreator, getTests);

/**
 * @swagger
 * /api/tests/published:
 *   get:
 *     summary: Get all published tests (For Student Dashboard / browsing)
 *     tags: [Tests]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of active published tests available to take
 */
router.get("/published", authMiddleware, requireStudent, getPublishedTests);

/**
 * @swagger
 * /api/tests/my-purchases:
 *   get:
 *     summary: Get all purchased tests for current student
 *     tags: [Tests]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of purchased tests
 */
router.get("/my-purchases", authMiddleware, getMyPurchases);

/**
 * @swagger
 * /api/tests/{id}:
 *   get:
 *     summary: Get test details by ID (including questions)
 *     tags: [Tests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Test ID
 *     responses:
 *       200:
 *         description: Test details and questions
 *       404:
 *         description: Test not found
 */
router.get("/:id", authMiddleware, getTestById);

/**
 * @swagger
 * /api/tests/{id}:
 *   put:
 *     summary: Update test details
 *     tags: [Tests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               duration:
 *                 type: number
 *               marksPerQuestion:
 *                 type: number
 *               negativeMarks:
 *                 type: number
 *     responses:
 *       200:
 *         description: Test updated successfully
 */
router.put("/:id", authMiddleware, requireTestCreator, updateTest);

/**
 * @swagger
 * /api/tests/{id}:
 *   delete:
 *     summary: Delete a test
 *     tags: [Tests]
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
 *         description: Test deleted successfully
 */
router.delete("/:id", authMiddleware, requireTestCreator, deleteTest);

/**
 * @swagger
 * /api/tests/{id}/publish:
 *   patch:
 *     summary: Toggle publish/unpublish status of a test
 *     tags: [Tests]
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
 *         description: Test publish status updated
 */
router.patch("/:id/publish", authMiddleware, requireTestCreator, toggleTestPublish);

/**
 * @swagger
 * /api/tests/{id}/questions:
 *   post:
 *     summary: Add question to a test
 *     tags: [Tests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - questionId
 *             properties:
 *               questionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Question added to test
 */
router.post("/:id/questions", authMiddleware, requireTestCreator, addQuestionToTest);

/**
 * @swagger
 * /api/tests/{id}/questions:
 *   delete:
 *     summary: Remove question from a test
 *     tags: [Tests]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - questionId
 *             properties:
 *               questionId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Question removed from test
 */
router.delete("/:id/questions", authMiddleware, requireTestCreator, removeQuestionFromTest);

/**
 * @swagger
 * /api/tests/{id}/purchase:
 *   post:
 *     summary: Purchase and unlock a paid test (Server-Side Access Control)
 *     tags: [Tests]
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
 *         description: Test purchased and unlocked
 */
router.post("/:id/purchase", authMiddleware, purchaseTest);

export default router;
