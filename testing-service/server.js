import "dotenv/config";

import express from "express";
import cors from "cors";

import connectDB from "./config/db.js";
import { query } from "./config/db.js";

import questionRoutes from "./routes/questionRoutes.js";
import examRoutes from "./routes/examRoutes.js";
import questionReportRoutes from "./routes/questionReportRoutes.js";
import testRoutes from "./routes/testRoutes.js";
import testSubmissionRoutes from "./routes/testSubmissionRoutes.js";
import swaggerUi from "swagger-ui-express";
import { swaggerDocs } from "./swagger.js";

const app = express();

app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-demo-role"],
}));

app.use(express.json());
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

connectDB();

app.use("/api/questions", questionRoutes);
app.use("/api/exams", examRoutes);
app.use("/api/question-reports", questionReportRoutes);
app.use("/api/tests", testRoutes);
app.use("/api/test-creation", testRoutes);
app.use("/api/test-submissions", testSubmissionRoutes);

// Normalize upload and route errors so clients receive predictable JSON responses.
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error?.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ success: false, message: "The PDF must be 15 MB or smaller." });
  }
  if (error instanceof Error && /upload a PDF file/i.test(error.message)) {
    return res.status(400).json({ success: false, message: error.message });
  }
  console.error("Testing service request error:", error?.message || "Unknown error");
  return res.status(500).json({ success: false, message: "The request could not be processed." });
});

const getApiOverview = (req, res) => {
  res.json({
    success: true,
    service: "Dexmy Test Portal Backend",
    version: "1.0.0",
    docs: "/api-docs",
    endpoints: {
      tests: {
        listAll: "GET /api/tests",
        create: "POST /api/tests",
        importPdf: "POST /api/tests/import-pdf (multipart field: pdf)",
        published: "GET /api/tests/published",
        getById: "GET /api/tests/:id",
        update: "PUT /api/tests/:id",
        delete: "DELETE /api/tests/:id",
        publish: "PATCH /api/tests/:id/publish",
        addQuestion: "POST /api/tests/:id/questions",
        removeQuestion: "DELETE /api/tests/:id/questions",
      },
      submissions: {
        submit: "POST /api/test-submissions",
        getById: "GET /api/test-submissions/:id",
        mySubmissions: "GET /api/test-submissions/my-submissions",
        studentSubmissions: "GET /api/test-submissions/student/:studentId",
      },
      questions: {
        list: "GET /api/questions",
        create: "POST /api/questions",
        getById: "GET /api/questions/:id",
      },
      legacyAliases: {
        testCreation: "/api/test-creation (mirrors /api/tests)",
      },
    },
  });
};

app.get("/", getApiOverview);
app.get("/api", getApiOverview);

app.get("/health", async (req, res) => {
  try {
    await query("SELECT 1");
    return res.status(200).json({ success: true, service: "testing-service", database: "ok" });
  } catch (error) {
    return res.status(503).json({ success: false, service: "testing-service", database: "unavailable" });
  }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Test Portal Server running on port ${PORT}`);
  console.log(`API Docs available at /api-docs`);
});

export default app;
