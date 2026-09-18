import http from "http";
import app from "../server.js";

const PORT = 5001; // test port
let server;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const reqHeaders = {
      "Content-Type": "application/json",
      ...headers,
    };
    if (data) {
      reqHeaders["Content-Length"] = Buffer.byteLength(data);
    }

    const req = http.request(
      {
        hostname: "localhost",
        port: PORT,
        path,
        method,
        headers: reqHeaders,
      },
      (res) => {
        let resData = "";
        res.on("data", (chunk) => (resData += chunk));
        res.on("end", () => {
          let parsed = null;
          try {
            parsed = JSON.parse(resData);
          } catch {
            parsed = resData;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );

    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log("TEST PORTAL ENDPOINTS VERIFICATION SUITE");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`PASS: ${message}`);
      passed++;
    } else {
      console.error(`FAIL: ${message}`);
      failed++;
    }
  }

  server = app.listen(PORT, async () => {
    try {
      // 1. Root & Discovery
      const rootRes = await request("GET", "/");
      assert(rootRes.status === 200 && rootRes.body.success, "Root API overview returned 200 OK");
      assert(rootRes.body.endpoints?.tests?.published === "GET /api/tests/published", "Endpoint discovery contains /api/tests/published");

      // 2. Swagger docs
      const swaggerRes = await request("GET", "/api-docs/");
      assert(swaggerRes.status === 200 || swaggerRes.status === 301, "Swagger docs endpoint reachable");

      // 3. Get published tests (Student flow)
      const pubRes = await request("GET", "/api/tests/published", null, {
        Authorization: "Bearer student",
      });
      assert(pubRes.status === 200 && Array.isArray(pubRes.body.tests), "GET /api/tests/published returns 200 with tests array");
      assert(pubRes.body.tests.length > 0, `Published tests found (${pubRes.body.tests.length} tests)`);

      // 4. Verify Free and Paid classification
      const freeTest = pubRes.body.tests.find((t) => !t.isPaid && !t.is_paid);
      const paidTest = pubRes.body.tests.find((t) => t.isPaid || t.is_paid);
      assert(freeTest !== undefined, `Free test available: "${freeTest?.title}"`);
      assert(paidTest !== undefined, `Paid test available: "${paidTest?.title}" (Price: ₹${paidTest?.price})`);

      // 5. Test compatibility attributes (both _id and id, isPublished and is_published)
      const firstTest = pubRes.body.tests[0];
      assert(firstTest.id && firstTest._id, `Test has both id ("${firstTest.id}") and _id ("${firstTest._id}")`);
      assert(firstTest.isPublished !== undefined && firstTest.is_published !== undefined, "Test has both isPublished and is_published");

      // 6. Get free test by ID
      const singleRes = await request("GET", `/api/tests/${freeTest.id}`, null, {
        Authorization: "Bearer student",
      });
      assert(singleRes.status === 200 && singleRes.body.test, `GET /api/tests/:id retrieved free test successfully with ${singleRes.body.test?.questions?.length || 0} questions`);

      // 6a. Server-Side Access Control for Paid Tests (Task 3 Section 14 & 16)
      if (paidTest) {
        const unpurchasedRes = await request("GET", `/api/tests/${paidTest.id}`, null, {
          Authorization: "Bearer student-new-unpurchased",
        });
        assert(unpurchasedRes.status === 403 && unpurchasedRes.body.requires_purchase, "Server-side paid test gate: Unpurchased student receives 403 Forbidden");

        // 6b. Purchase Paid Test
        const buyRes = await request("POST", `/api/tests/${paidTest.id}/purchase`, null, {
          Authorization: "Bearer student-new-unpurchased",
        });
        assert(buyRes.status === 200 && buyRes.body.is_purchased, "POST /api/tests/:id/purchase unlocks test for student");

        // 6c. Now access paid test questions
        const unlockedRes = await request("GET", `/api/tests/${paidTest.id}`, null, {
          Authorization: "Bearer student-new-unpurchased",
        });
        assert(unlockedRes.status === 200 && unlockedRes.body.test?.questions?.length > 0, "After purchase: Student successfully accesses paid test questions");

        // 6d. Check my purchases
        const myPurchasesRes = await request("GET", "/api/tests/my-purchases", null, {
          Authorization: "Bearer student-new-unpurchased",
        });
        assert(myPurchasesRes.status === 200 && myPurchasesRes.body.purchases?.length > 0, "GET /api/tests/my-purchases lists student purchased tests");
      }

      // 7. Backward compatibility with /api/test-creation/published
      const legacyRes = await request("GET", "/api/test-creation/published", null, {
        Authorization: "Bearer student",
      });
      assert(legacyRes.status === 200 && legacyRes.body.tests?.length > 0, "GET /api/test-creation/published legacy alias works");

      // 8. Create Test (Teacher / Test Creator flow)
      const newTestPayload = {
        title: "Integration Verification Exam",
        description: "Created during endpoint verification",
        subject: "General Awareness",
        duration: 25,
        marksPerQuestion: 2,
        negativeMarks: 0.5,
        isPaid: false,
      };
      const createRes = await request("POST", "/api/tests", newTestPayload, {
        Authorization: "Bearer test_creator",
      });
      assert(createRes.status === 201 && createRes.body.test, "POST /api/tests created test with Test Creator role");
      const createdTestId = createRes.body.test?.id || createRes.body.test?._id;

      // 9. Publish toggle
      if (createdTestId) {
        const pubToggle = await request("PATCH", `/api/tests/${createdTestId}/publish`, null, {
          Authorization: "Bearer test_creator",
        });
        assert(pubToggle.status === 200 && pubToggle.body.test?.isPublished, "PATCH /api/tests/:id/publish toggled status to published");
      }

      // 10. Student Test Submission
      const submissionPayload = {
        testId: firstTest.id,
        answers: [
          { questionId: firstTest.questions?.[0]?.id || "q-101", selectedAnswer: 0 },
          { questionId: firstTest.questions?.[1]?.id || "q-102", selectedAnswer: 1 },
        ],
      };
      const subRes = await request("POST", "/api/test-submissions", submissionPayload, {
        Authorization: "Bearer student",
      });
      assert(subRes.status === 201 && subRes.body.result, `POST /api/test-submissions scored attempt: ${subRes.body.result?.obtainedMarks}/${subRes.body.result?.totalMarks} marks (${subRes.body.result?.percentage}%)`);

      // 11. Student submissions retrieval
      const mySubRes = await request("GET", "/api/test-submissions/my-submissions", null, {
        Authorization: "Bearer student",
      });
      assert(mySubRes.status === 200 && Array.isArray(mySubRes.body.submissions), `GET /api/test-submissions/my-submissions retrieved ${mySubRes.body.submissions?.length || 0} submissions`);

      console.log(`TOTAL: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);

      server.close();
      process.exit(failed > 0 ? 1 : 0);
    } catch (err) {
      console.error("Test error:", err);
      server.close();
      process.exit(1);
    }
  });
}

runTests();
