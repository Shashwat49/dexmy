# Dexmy Test Creator: PDF-to-test import

The Test Creator can now use **Create from PDF** alongside the existing manual test-creation workflow.

## Runtime configuration

Set these variables on the Testing Service deployment (for example, the Railway service that runs `testing-service`):

- `OPENAI_API_KEY` — required; keep this server-side secret and never expose it as a frontend `VITE_*` variable.
- `OPENAI_PDF_TEST_MODEL` — optional; defaults to `gpt-4o-mini`.

Redeploy the Testing Service after setting the key. Without `OPENAI_API_KEY`, the endpoint returns a clear configuration error and does not attempt extraction.

## Behavior

- Endpoint: `POST /api/tests/import-pdf`, authenticated for Test Creator/admin roles.
- Multipart form field: `pdf`.
- Upload limit: 15 MB, one PDF per request; the service checks the file signature as well as the extension.
- The PDF is sent to the OpenAI Responses API for structured question extraction. The response is validated before it is returned to the browser.
- Questions and AI-suggested answers are drafts only. The Test Creator must edit as needed, select the correct answer, and explicitly confirm verification for every question before saving.
- The final test is saved as an unpublished draft through the existing test/question APIs. Manual creation and the question bank remain available.
- Existing student scoring supports option-index answers, so this first version imports multiple-choice questions. Non-MCQ/numeric-entry items are called out in extraction notes for manual handling.
- The AI may describe diagram details in text, but this version does not persist an extracted diagram image as a separate question image. Always inspect diagram-dependent questions against the original PDF.

## Verification

Run from `testing-service/`:

```sh
npm install
npm test
```

The endpoint verification suite includes a check that a missing PDF is rejected. End-to-end AI extraction also requires a valid `OPENAI_API_KEY` and a real PDF; avoid placing real student or otherwise sensitive documents into test fixtures.
