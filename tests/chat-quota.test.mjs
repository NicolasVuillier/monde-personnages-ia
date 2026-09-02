import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));

function createQuotaDatabase() {
  const counters = new Map();

  return {
    prepare(query) {
      assert.match(query, /INSERT INTO daily_chat_usage/);
      let values = [];
      return {
        bind(...nextValues) {
          values = nextValues;
          return this;
        },
        async first() {
          const [identityHash, day, limit] = values;
          const key = `${identityHash}:${day}`;
          const current = counters.get(key) ?? 0;
          if (current >= limit) return null;
          const messageCount = current + 1;
          counters.set(key, messageCount);
          return { messageCount };
        },
      };
    },
  };
}

test("limits one authenticated user to 30 chat messages per Paris calendar day", async () => {
  const previousApiKey = process.env.OPENROUTER_API_KEY;
  const originalFetch = globalThis.fetch;
  const database = createQuotaDatabase();
  globalThis.__CHAT_QUOTA_TEST_ENV__ = { DB: database };
  process.env.OPENROUTER_API_KEY = "test-openrouter-key";
  let upstreamCalls = 0;
  const vite = await createServer({
    appType: "custom",
    configFile: false,
    root,
    resolve: { alias: { "@": root } },
    plugins: [{
      name: "chat-quota-cloudflare-environment",
      enforce: "pre",
      resolveId(source) {
        return source === "cloudflare:workers" ? "\0chat-quota-cloudflare-environment" : null;
      },
      load(id) {
        return id === "\0chat-quota-cloudflare-environment"
          ? "export const env = globalThis.__CHAT_QUOTA_TEST_ENV__;"
          : null;
      },
    }],
  });

  try {
    globalThis.fetch = async (input) => {
      assert.equal(String(input), "https://openrouter.ai/api/v1/chat/completions");
      upstreamCalls += 1;
      return Response.json({ choices: [{ message: { content: "Je te réponds." } }] });
    };

    const { POST } = await vite.ssrLoadModule("/app/api/chat/route.ts");
    const requestBody = JSON.stringify({
      character: {
        name: "Orphée",
        subtitle: "Poète de Thrace",
        description: "Je chante avec ma lyre dans les monts Rhodopes.",
        responseLength: "standard",
      },
      messages: [{ role: "user", content: "Bonjour Orphée" }],
    });

    for (let messageNumber = 1; messageNumber <= 30; messageNumber += 1) {
      const response = await POST(
        new Request("http://localhost/api/chat", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "oai-authenticated-user-email": "visiteur@example.com",
          },
          body: requestBody,
        }),
      );

      assert.equal(response.status, 200);
      assert.equal(Number(response.headers.get("x-ratelimit-remaining")), 30 - messageNumber);
    }

    const blocked = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "oai-authenticated-user-email": "visiteur@example.com",
        },
        body: requestBody,
      }),
    );

    assert.equal(blocked.status, 429);
    assert.equal(upstreamCalls, 30);
    const blockedPayload = await blocked.json();
    assert.equal(
      blockedPayload.error,
      "Tu as atteint la limite de 30 messages pour aujourd’hui. Tu pourras reprendre demain à minuit, heure de Paris.",
    );
    assert.equal(blockedPayload.quota.limit, 30);
    assert.equal(blockedPayload.quota.remaining, 0);
    assert.match(blockedPayload.quota.day, /^\d{4}-\d{2}-\d{2}$/);

    const firstAnonymousResponse = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: requestBody,
      }),
    );
    const anonymousCookie = firstAnonymousResponse.headers.get("set-cookie")?.split(";", 1)[0];
    assert.equal(firstAnonymousResponse.status, 200);
    assert.match(anonymousCookie ?? "", /^world_chat_user=/);
    assert.equal(Number(firstAnonymousResponse.headers.get("x-ratelimit-remaining")), 29);

    const secondAnonymousResponse = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: anonymousCookie,
        },
        body: requestBody,
      }),
    );
    assert.equal(secondAnonymousResponse.status, 200);
    assert.equal(Number(secondAnonymousResponse.headers.get("x-ratelimit-remaining")), 28);
    assert.equal(upstreamCalls, 32);
  } finally {
    globalThis.fetch = originalFetch;
    delete globalThis.__CHAT_QUOTA_TEST_ENV__;
    await vite.close();
    if (previousApiKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = previousApiKey;
  }
});
