import { query } from "../config/db.js";\nimport { DEFAULT_DEMO_TESTS, checkTestPurchased } from "./testController.js";

let schemaReadyPromise = null;

const ensureSessionSchema = async () => {
  if (!schemaReadyPromise) {
    schemaReadyPromise = query(`
      CREATE TABLE IF NOT EXISTS test_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        test_id VARCHAR(255) NOT NULL,
        student_id UUID NOT NULL,
        started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        answers JSONB NOT NULL DEFAULT '[]'::jsonb,
        status VARCHAR(20) NOT NULL DEFAULT 'IN_PROGRESS',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_test_sessions_student_test
        ON test_sessions(student_id, test_id);
      CREATE INDEX IF NOT EXISTS idx_test_sessions_expires_at
        ON test_sessions(expires_at);
    `).catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }
  return schemaReadyPromise;
};

const getStudentId = (req) => req.user?.id || req.user?.sub;

export const startTestSession = async (req, res) => {
  try {
    const { testId } = req.body;
    const studentId = getStudentId(req);

    if (!testId) {
      return res.status(400).json({ success: false, message: "Test ID is required" });
    }
    if (!studentId) {
      return res.status(401).json({ success: false, message: "Student identity is required" });
    }

    await ensureSessionSchema();

    const testResult = await query(
      `SELECT id, duration, is_published, is_paid, price
       FROM tests
       WHERE id = $1`,
      [testId]
    );

    if (testResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Test not found" });
    }

    const test = testResult.rows[0];

    if (!test.is_published) {
      return res.status(403).json({ success: false, message: "This test is not published" });
    }

    if (test.is_paid) {
      const privileged = ["admin", "super_admin", "test_creator"].includes(req.user?.role);
      const hasPurchased = privileged
        ? true
        : await checkTestPurchased(testId, studentId);
      if (!privileged && !hasPurchased) {
        return res.status(403).json({
          success: false,
          message: "Access denied: purchase required before starting this test",
          requires_purchase: true,
        });
      }
    }

    // Reuse the currently active session for this student/test. This keeps
    // multiple tabs consistent without imposing any attempt-count restriction.
    const active = await query(
      `SELECT id, test_id, started_at, expires_at, answers, status
       FROM test_sessions
       WHERE test_id = $1
         AND student_id = $2
         AND status = 'IN_PROGRESS'
         AND expires_at > CURRENT_TIMESTAMP
       ORDER BY started_at DESC
       LIMIT 1`,
      [testId, studentId]
    );

    if (active.rows.length > 0) {
      const session = active.rows[0];
      return res.status(200).json({
        success: true,
        session: {
          id: session.id,
          testId: session.test_id,
          startedAt: session.started_at,
          expiresAt: session.expires_at,
          answers: Array.isArray(session.answers) ? session.answers : [],
          status: session.status,
        },
      });
    }

    const durationMinutes = Number(test.duration);
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      return res.status(400).json({ success: false, message: "Test has an invalid duration" });
    }

    const sessionResult = await query(
      `INSERT INTO test_sessions (test_id, student_id, started_at, expires_at)
       VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP + ($3 * INTERVAL '1 minute'))
       RETURNING id, test_id, started_at, expires_at, answers, status`,
      [testId, studentId, durationMinutes]
    );

    const session = sessionResult.rows[0];
    return res.status(201).json({
      success: true,
      session: {
        id: session.id,
        testId: session.test_id,
        startedAt: session.started_at,
        expiresAt: session.expires_at,
        answers: Array.isArray(session.answers) ? session.answers : [],
        status: session.status,
      },
    });
  } catch (error) {
    console.error("START TEST SESSION ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to start test session", error: error.message });
  }
};

export const getTestSession = async (req, res) => {
  try {
    const { id } = req.params;
    const studentId = getStudentId(req);

    if (!studentId) {
      return res.status(401).json({ success: false, message: "Student identity is required" });
    }

    await ensureSessionSchema();

    const result = await query(
      `SELECT id, test_id, started_at, expires_at, answers, status
       FROM test_sessions
       WHERE id = $1 AND student_id = $2`,
      [id, studentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Test session not found" });
    }

    const session = result.rows[0];
    return res.status(200).json({
      success: true,
      session: {
        id: session.id,
        testId: session.test_id,
        startedAt: session.started_at,
        expiresAt: session.expires_at,
        answers: Array.isArray(session.answers) ? session.answers : [],
        status: session.status,
      },
    });
  } catch (error) {
    console.error("GET TEST SESSION ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch test session", error: error.message });
  }
};

export const saveTestSession = async (req, res) => {
  try {
    const { id } = req.params;
    const { answers } = req.body;
    const studentId = getStudentId(req);

    if (!studentId) {
      return res.status(401).json({ success: false, message: "Student identity is required" });
    }
    if (!Array.isArray(answers)) {
      return res.status(400).json({ success: false, message: "Answers must be an array" });
    }

    await ensureSessionSchema();

    const result = await query(
      `UPDATE test_sessions
       SET answers = $1::jsonb, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
         AND student_id = $3
         AND status = 'IN_PROGRESS'
         AND expires_at > CURRENT_TIMESTAMP
       RETURNING id, test_id, started_at, expires_at, answers, status`,
      [JSON.stringify(answers), id, studentId]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({
        success: false,
        message: "Test session is no longer active",
        expired: true,
      });
    }

    const session = result.rows[0];
    return res.status(200).json({
      success: true,
      session: {
        id: session.id,
        testId: session.test_id,
        startedAt: session.started_at,
        expiresAt: session.expires_at,
        answers: Array.isArray(session.answers) ? session.answers : [],
        status: session.status,
      },
    });
  } catch (error) {
    console.error("SAVE TEST SESSION ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to save test session", error: error.message });
  }
};
