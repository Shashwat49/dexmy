import { randomUUID } from "node:crypto";

const MAX_QUESTIONS = 80;
const MODEL = process.env.OPENAI_PDF_TEST_MODEL || "gpt-4o-mini";

const questionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          questionText: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          correctAnswer: { type: ["integer", "null"] },
          answerSource: { type: "string", enum: ["provided", "ai_suggested", "needs_manual"] },
          explanation: { type: "string" },
          marks: { type: "number" },
          negativeMarks: { type: "number" },
          subject: { type: "string" },
          difficulty: { type: "string", enum: ["Easy", "Medium", "Hard"] },
        },
        required: ["questionText", "options", "correctAnswer", "answerSource", "explanation", "marks", "negativeMarks", "subject", "difficulty"],
      },
    },
    notes: { type: "array", items: { type: "string" } },
  },
  required: ["questions", "notes"],
};

function extractOutputText(response) {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }
  const textParts = [];
  for (const item of response.output || []) {
    for (const part of item.content || []) {
      if (part.type === "output_text" && typeof part.text === "string") textParts.push(part.text);
    }
  }
  return textParts.join("\n");
}

function validateQuestion(question, index) {
  const questionText = String(question?.questionText || "").trim();
  const options = Array.isArray(question?.options)
    ? question.options.map((option) => String(option || "").trim())
    : [];
  const correctAnswer = question?.correctAnswer;
  if (!questionText) throw new Error(`Question ${index + 1} has no question text.`);
  if (options.length < 2 || options.length > 5 || options.some((option) => !option)) {
    throw new Error(`Question ${index + 1} must contain 2–5 non-empty answer options.`);
  }
  if (correctAnswer !== null && (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer >= options.length)) {
    throw new Error(`Question ${index + 1} has an invalid answer index.`);
  }
  const answerSource = ["provided", "ai_suggested", "needs_manual"].includes(question.answerSource)
    ? question.answerSource
    : "needs_manual";
  return {
    id: randomUUID(),
    questionText,
    options,
    correctAnswer,
    answerSource,
    explanation: String(question.explanation || ""),
    marks: Number.isFinite(Number(question.marks)) && Number(question.marks) >= 0 ? Number(question.marks) : 1,
    negativeMarks: Number.isFinite(Number(question.negativeMarks)) && Number(question.negativeMarks) >= 0 ? Number(question.negativeMarks) : 0,
    subject: String(question.subject || "General").trim().slice(0, 120),
    difficulty: ["Easy", "Medium", "Hard"].includes(question.difficulty) ? question.difficulty : "Medium",
    verified: false,
  };
}

export const importPdfQuestions = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Choose a PDF file to upload." });
    }
    if (!req.file.buffer.subarray(0, 5).toString("ascii").startsWith("%PDF-")) {
      return res.status(400).json({ success: false, message: "The uploaded file is not a valid PDF." });
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        success: false,
        code: "PDF_AI_NOT_CONFIGURED",
        message: "PDF question extraction is not configured yet. Set OPENAI_API_KEY in the Testing Service environment and redeploy.",
      });
    }

    const instructions = [
      "Convert the attached PDF into a draft of multiple-choice test questions.",
      "Extract only questions actually present in the document; do not invent missing questions or options.",
      "Preserve mathematical notation as readable plain text/Unicode/LaTeX where possible.",
      "If a question relies on a diagram, describe the relevant diagram details in the question text rather than inventing unseen measurements.",
      "Include 2 to 5 answer options for each returned question. Skip non-MCQ/numeric-entry questions and mention them in notes so the creator can enter them manually.",
      "If an answer key is present in the PDF, use it and set answerSource='provided'.",
      "If no key is present, solve the question when possible and set answerSource='ai_suggested'. If uncertain, set correctAnswer=null and answerSource='needs_manual'.",
      "correctAnswer is a zero-based option index. Never claim an uncertain answer is verified.",
      "Use marks=1 and negativeMarks=0 when not specified. Do not treat a worked solution as an answer key unless it clearly identifies the correct answer.",
      "Return concise explanations for suggested answers, and notes about unreadable, ambiguous, skipped, or non-MCQ content.",
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        max_output_tokens: 12000,
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: instructions },
            {
              type: "input_file",
              filename: req.file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "question-paper.pdf",
              file_data: `data:application/pdf;base64,${req.file.buffer.toString("base64")}`,
            },
          ],
        }],
        text: {
          format: {
            type: "json_schema",
            name: "dexmy_pdf_test_questions",
            strict: true,
            schema: questionSchema,
          },
        },
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error("PDF import model request failed:", response.status, payload?.error?.code || payload?.error?.type || "unknown_error");
      if (response.status === 401 || response.status === 403) {
        return res.status(503).json({ success: false, message: "PDF extraction service credentials are invalid or lack permission." });
      }
      if (response.status === 429) {
        return res.status(503).json({ success: false, message: "PDF extraction is temporarily rate-limited. Please try again shortly." });
      }
      return res.status(502).json({ success: false, message: "The PDF could not be processed. Try a smaller or clearer PDF." });
    }

    const outputText = extractOutputText(payload);
    let parsed;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      return res.status(502).json({ success: false, message: "The extraction service returned an unreadable result. Please try again." });
    }

    if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      return res.status(422).json({
        success: false,
        message: "No multiple-choice questions could be extracted. The PDF may be scanned unclearly or contain unsupported question types.",
        notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      });
    }
    if (parsed.questions.length > MAX_QUESTIONS) {
      return res.status(422).json({ success: false, message: `Please upload a paper with no more than ${MAX_QUESTIONS} questions at a time.` });
    }

    let questions;
    try {
      questions = parsed.questions.map(validateQuestion);
    } catch (validationError) {
      return res.status(502).json({ success: false, message: `The extracted draft needs correction: ${validationError.message}` });
    }

    return res.status(200).json({
      success: true,
      questions,
      notes: Array.isArray(parsed.notes) ? parsed.notes.map((note) => String(note).slice(0, 500)) : [],
      model: MODEL,
      reviewRequired: true,
    });
  } catch (error) {
    console.error("PDF TEST IMPORT ERROR:", error.message);
    return res.status(500).json({ success: false, message: "Failed to extract questions from the PDF." });
  }
};
