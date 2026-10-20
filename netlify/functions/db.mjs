import { getStore } from "@netlify/blobs";

/* Coldroom data API.
   GET    /api/db/:collection       -> every document in the collection
   GET    /api/db/:collection/:id   -> one document
   PUT    /api/db/:collection/:id   -> create or replace
   DELETE /api/db/:collection/:id   -> remove

   If the COLDROOM_KEY environment variable is set, every request must carry
   the same value in an x-coldroom-key header. Remove the variable in Netlify
   (Site configuration -> Environment variables) to turn the gate off. */

const COLLECTIONS = new Set([
  "config", "products", "locations", "history", "plan", "stocktakes", "runs",
]);

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

const store = () => getStore({ name: "coldroom", consistency: "strong" });

export default async (req, context) => {
  const key = process.env.COLDROOM_KEY;
  if (key && req.headers.get("x-coldroom-key") !== key) {
    return json({ error: "passphrase required" }, 401);
  }

  const { collection, id } = context.params;
  if (!COLLECTIONS.has(collection)) {
    return json({ error: "unknown collection: " + collection }, 404);
  }

  const s = store();

  try {
    if (req.method === "GET" && !id) {
      const { blobs } = await s.list({ prefix: collection + "/" });
      const docs = await Promise.all(
        blobs.map((b) => s.get(b.key, { type: "json" }))
      );
      return json(docs.filter(Boolean));
    }

    if (req.method === "GET") {
      const doc = await s.get(collection + "/" + id, { type: "json" });
      return doc ? json(doc) : json({ error: "not found" }, 404);
    }

    if (req.method === "PUT") {
      const body = await req.json();
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return json({ error: "body must be a JSON object" }, 400);
      }
      await s.setJSON(collection + "/" + id, { ...body, id });
      return json({ ok: true, id });
    }

    if (req.method === "DELETE") {
      await s.delete(collection + "/" + id);
      return json({ ok: true, id });
    }

    return json({ error: "method not allowed" }, 405);
  } catch (err) {
    return json({ error: String((err && err.message) || err) }, 500);
  }
};

export const config = {
  path: ["/api/db/:collection", "/api/db/:collection/:id"],
};
