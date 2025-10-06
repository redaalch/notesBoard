import app from "../src/app.js";
import { connectDb } from "../src/config/db.js";

await connectDb();

const server = app.listen(0);
await new Promise((resolve, reject) => {
  server.once("listening", resolve);
  server.once("error", reject);
});

const { port } = server.address();

try {
  const headers = { "Content-Type": "application/json" };
  if (process.env.TEST_ORIGIN) {
    headers.Origin = process.env.TEST_ORIGIN;
  }

  const response = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: process.env.TEST_EMAIL ?? "testuser@example.com",
      password: process.env.TEST_PASSWORD ?? "TestPass123",
    }),
  });

  console.log("status", response.status);
  const body = await response.text();
  console.log("body", body);
} finally {
  await new Promise((resolve) => server.close(resolve));
  process.exit();
}
