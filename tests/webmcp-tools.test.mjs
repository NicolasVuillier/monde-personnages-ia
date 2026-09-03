import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));

test("registers immediate creation and direct editing tools", async () => {
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
      status: "published",
      isRemote: true,
    };
    const registration = registerWorldTools({
      getCharacters: () => [orphee],
      refreshCharacters: async (ids) => refreshed.push(ids),
      focusCharacters: (ids) => focused.push(ids),
      reportActivity: () => undefined,
    });

    await Promise.resolve();
    assert.equal(registration.available, true);
    assert.deepEqual(
      registered.map((tool) => tool.name),
      [
        "list_world_characters",
        "create_world_characters",
        "get_world_character",
        "update_world_character",
        "generate_character_avatar",
        "show_characters_on_map",
        "delete_world_characters",
      ],
    );

    const createTool = registered.find((tool) => tool.name === "create_world_characters");
    const created = await createTool.execute({ characters: [{ name: "Athéna" }, { name: "Orphée" }] });
    assert.deepEqual(refreshed, [["athena-test", "orphee-test"]]);
    assert.deepEqual(focused, [["athena-test", "orphee-test"]]);
    assert.equal(created.created.length, 2);
    assert.equal(created.visibility, "published");

    const getTool = registered.find((tool) => tool.name === "get_world_character");
    const detail = getTool.execute({ id: "orphee-test" });
    assert.equal(getTool.annotations.readOnlyHint, true);
    assert.equal(detail.character.description, orphee.description);
    assert.equal(detail.character.responseLength, "developpee");
    assert.deepEqual(detail.character.relationStrengths, { apollon: 0.7, dionysos: 0.9 });

    const updateTool = registered.find((tool) => tool.name === "update_world_character");
    assert.deepEqual(updateTool.inputSchema.properties.changes.properties.responseLength.enum, ["courte", "standard", "developpee"]);
    assert.deepEqual(updateTool.inputSchema.properties.changes.properties.relationChanges.items.properties.action.enum, ["add", "remove", "set_strength"]);

    const deleteTool = registered.find((tool) => tool.name === "delete_world_characters");
    assert.equal(deleteTool.inputSchema.properties.ids.maxItems, 20);

    registration.dispose();
  } finally {
    globalThis.document = originalDocument;
    globalThis.fetch = originalFetch;
    await vite.close();
  }
});
