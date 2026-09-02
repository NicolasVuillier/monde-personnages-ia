import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));

test("registers a batch creation flow with human publication review", async () => {
  const vite = await createServer({
    appType: "custom",
    configFile: false,
    root,
    resolve: { alias: { "@": root } },
    server: { middlewareMode: true },
  });
  const registered = [];
  const originalDocument = globalThis.document;
  const originalFetch = globalThis.fetch;

  try {
    globalThis.document = {
      modelContext: {
        registerTool(tool) {
          registered.push(tool);
        },
      },
    };
    globalThis.fetch = async () => Response.json({
      characters: [
        { id: "athena-test", name: "Athéna" },
        { id: "orphee-test", name: "Orphée" },
      ],
    }, { status: 201 });

    const { registerWorldTools } = await vite.ssrLoadModule("/features/webmcp/register-world-tools.ts");
    const refreshed = [];
    const focused = [];
    const reviewed = [];
    const orphee = {
      id: "orphee-test",
      name: "Orphée",
      subtitle: "Poète de Thrace",
      category: "Mythes",
      location: "Monts Rhodopes",
      era: "Âge héroïque",
      lng: 24.69,
      lat: 41.59,
      color: "#79e6c3",
      avatar: "/api/avatars/orphee.png",
      popularity: 0.9,
      description: "Poète capable d'émouvoir le monde vivant.",
      greeting: "Écoute ma lyre.",
      reply: "Je me souviens d'Eurydice.",
      relations: ["apollon", "dionysos"],
      relationStrengths: { apollon: 0.7, dionysos: 0.9 },
      responseLength: "developpee",
      status: "draft",
      isRemote: true,
    };
    const registration = registerWorldTools({
      getCharacters: () => [orphee],
      refreshCharacters: async (ids) => refreshed.push(ids),
      focusCharacters: (ids) => focused.push(ids),
      requestPublicationReview: (ids) => reviewed.push(ids),
      reportActivity: () => undefined,
    });

    await Promise.resolve();
    assert.equal(registration.available, true);
    assert.deepEqual(
      registered.map((tool) => tool.name),
      [
        "list_world_characters",
        "create_character_drafts",
        "get_world_character",
        "update_world_character",
        "generate_character_avatar",
        "show_characters_on_map",
        "request_publish_characters",
      ],
    );

    const createTool = registered.find((tool) => tool.name === "create_character_drafts");
    const created = await createTool.execute({ characters: [{ name: "Athéna" }, { name: "Orphée" }] });
    assert.deepEqual(refreshed, [["athena-test", "orphee-test"]]);
    assert.deepEqual(focused, [["athena-test", "orphee-test"]]);
    assert.equal(created.created.length, 2);

    const getTool = registered.find((tool) => tool.name === "get_world_character");
    const detail = getTool.execute({ id: "orphee-test" });
    assert.equal(getTool.annotations.readOnlyHint, true);
    assert.equal(detail.character.description, orphee.description);
    assert.equal(detail.character.responseLength, "developpee");
    assert.deepEqual(detail.character.relationStrengths, { apollon: 0.7, dionysos: 0.9 });

    const updateTool = registered.find((tool) => tool.name === "update_world_character");
    assert.deepEqual(updateTool.inputSchema.properties.changes.properties.responseLength.enum, ["courte", "standard", "developpee"]);
    assert.deepEqual(updateTool.inputSchema.properties.changes.properties.relationChanges.items.properties.action.enum, ["add", "remove", "set_strength"]);

    const publishTool = registered.find((tool) => tool.name === "request_publish_characters");
    const publication = publishTool.execute({ ids: ["athena-test", "orphee-test"] });
    assert.deepEqual(reviewed, [["athena-test", "orphee-test"]]);
    assert.equal(publication.status, "awaiting_human_confirmation");
    registration.dispose();
  } finally {
    globalThis.document = originalDocument;
    globalThis.fetch = originalFetch;
    await vite.close();
  }
});
