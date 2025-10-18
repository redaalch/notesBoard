import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import bcrypt from "bcryptjs";

import { generateAccessToken } from "../src/utils/tokenService.js";
import User from "../src/models/User.js";
import Notebook from "../src/models/Notebook.js";
import SavedNotebookQuery from "../src/models/SavedNotebookQuery.js";

let app;
let mongo;

const authHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  "X-Test-Client-Id": "saved-queries-tests",
});

beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_ACCESS_SECRET = "test-access-secret";

  mongo = await MongoMemoryServer.create();
  const uri = mongo.getUri();
  await mongoose.connect(uri, {
    dbName: "savedQueriesController",
  });

  ({ default: app } = await import("../src/app.js"));
});

afterEach(async () => {
  await Promise.all([
    SavedNotebookQuery.deleteMany({}),
    Notebook.deleteMany({}),
    User.deleteMany({}),
  ]);
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) {
    await mongo.stop();
  }
});

const createUserWithNotebook = async ({
  email,
  name,
  password = "Password123!",
  notebookName,
}) => {
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email,
    passwordHash,
    emailVerified: true,
  });

  const notebook = await Notebook.create({
    owner: user._id,
    name: notebookName,
  });

  const token = generateAccessToken({
    id: user._id.toString(),
    email: user.email,
    role: user.role,
  });

  return { user, notebook, token };
};

describe("notebook saved queries endpoints", () => {
  it("allows owners to manage saved query lifecycle", async () => {
    const { notebook, token } = await createUserWithNotebook({
      email: "owner@example.com",
      name: "Owner",
      notebookName: "Saved Query Notebook",
    });

    const notebookId = notebook._id.toString();

    const initialList = await request(app)
      .get(`/api/notebooks/${notebookId}/saved-queries`)
      .set(authHeaders(token));

    expect(initialList.status).toBe(200);
    expect(initialList.body).toEqual({ queries: [] });

    const filters = {
      tags: ["ops"],
      pinned: true,
    };
    const sort = { updatedAt: "desc" };

    const createRes = await request(app)
      .post(`/api/notebooks/${notebookId}/saved-queries`)
      .set(authHeaders(token))
      .send({
        name: "Recent Ops",
        query: "ops",
        filters,
        sort,
        scope: "notebook",
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.name).toBe("Recent Ops");
    expect(createRes.body.filters).toEqual(filters);
    expect(createRes.body.sort).toEqual(sort);
    expect(createRes.body.metadata).toEqual({});
    expect(createRes.body.lastUsedAt).toBeNull();

    const { id: savedQueryId } = createRes.body;

    const listRes = await request(app)
      .get(`/api/notebooks/${notebookId}/saved-queries`)
      .set(authHeaders(token));

    expect(listRes.status).toBe(200);
    expect(listRes.body.queries).toHaveLength(1);
    expect(listRes.body.queries[0].id).toBe(savedQueryId);

    const updateRes = await request(app)
      .patch(`/api/notebooks/${notebookId}/saved-queries/${savedQueryId}`)
      .set(authHeaders(token))
      .send({
        name: "Pinned Ops",
        scope: "workspace",
        filters: { ...filters, notebookIds: [notebookId] },
        sort: { updatedAt: "asc" },
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.name).toBe("Pinned Ops");
    expect(updateRes.body.scope).toBe("workspace");
    expect(updateRes.body.filters.notebookIds).toEqual([notebookId]);
    expect(updateRes.body.sort).toEqual({ updatedAt: "asc" });

    const touchRes = await request(app)
      .post(`/api/notebooks/${notebookId}/saved-queries/${savedQueryId}/use`)
      .set(authHeaders(token));

    expect(touchRes.status).toBe(200);
    expect(touchRes.body.id).toBe(savedQueryId);
    expect(typeof touchRes.body.lastUsedAt).toBe("string");
    expect(new Date(touchRes.body.lastUsedAt).getTime()).toBeLessThanOrEqual(
      Date.now()
    );

    const deleteRes = await request(app)
      .delete(`/api/notebooks/${notebookId}/saved-queries/${savedQueryId}`)
      .set(authHeaders(token));

    expect(deleteRes.status).toBe(204);

    const finalList = await request(app)
      .get(`/api/notebooks/${notebookId}/saved-queries`)
      .set(authHeaders(token));

    expect(finalList.status).toBe(200);
    expect(finalList.body.queries).toHaveLength(0);
  });

  it("rejects duplicate saved query names for the same user and notebook", async () => {
    const { notebook, token } = await createUserWithNotebook({
      email: "owner2@example.com",
      name: "Owner Two",
      notebookName: "Conflicts",
    });

    const notebookId = notebook._id.toString();

    const payload = {
      name: "My Query",
      query: "tag:focus",
      filters: { tags: ["focus"] },
      sort: { updatedAt: "desc" },
    };

    const firstCreate = await request(app)
      .post(`/api/notebooks/${notebookId}/saved-queries`)
      .set(authHeaders(token))
      .send(payload);

    expect(firstCreate.status).toBe(201);

    const conflict = await request(app)
      .post(`/api/notebooks/${notebookId}/saved-queries`)
      .set(authHeaders(token))
      .send(payload);

    expect(conflict.status).toBe(409);
    expect(conflict.body.message).toMatch(/already exists/i);
  });

  it("prevents non-owners from accessing saved queries", async () => {
    const { notebook } = await createUserWithNotebook({
      email: "owner3@example.com",
      name: "Owner Three",
      notebookName: "Secure",
    });

    const { token: outsiderToken } = await createUserWithNotebook({
      email: "outsider@example.com",
      name: "Outsider",
      notebookName: "Other",
    });

    const notebookId = notebook._id.toString();

    const forbiddenList = await request(app)
      .get(`/api/notebooks/${notebookId}/saved-queries`)
      .set(authHeaders(outsiderToken));

    expect(forbiddenList.status).toBe(404);

    const forbiddenCreate = await request(app)
      .post(`/api/notebooks/${notebookId}/saved-queries`)
      .set(authHeaders(outsiderToken))
      .send({
        name: "Should Fail",
        query: "test",
      });

    expect(forbiddenCreate.status).toBe(404);
  });
});
