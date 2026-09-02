import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));

function character(overrides) {
  return {
    id: "character",
    name: "Personnage",
    subtitle: "",
    category: "Histoire",
    location: "",
    era: "",
    lng: 0,
    lat: 0,
    color: "#79e6c3",
    avatar: "https://api.dicebear.com/avatar.svg",
    popularity: 0.5,
    description: "",
    greeting: "",
    reply: "",
    relations: [],
    ...overrides,
  };
}

test("uses one stable portrait for distant groups and reveals individual avatars nearby", async () => {
  const vite = await createServer({
    appType: "custom",
    configFile: false,
    root,
    resolve: { alias: { "@": root } },
    server: { middlewareMode: true },
  });

  try {
    const {
      buildCharacterDispatchOrigins,
      buildCharacterMarkerDescriptors,
      buildDispatchRenderDescriptors,
    } = await vite.ssrLoadModule("/features/map/character-map.tsx");
    const characters = [
      character({ id: "zeus", name: "Zeus", lng: 22.36, lat: 40.09, popularity: 1, avatar: "/avatars/mythology/zeus.jpg" }),
      character({ id: "hera", name: "Héra", lng: 22.78, lat: 37.69, popularity: 0.93 }),
      character({ id: "apollo", name: "Apollon", lng: 22.5, lat: 38.48, popularity: 0.96 }),
      character({ id: "leonard", name: "Léonard", lng: 9.18, lat: 45.47, popularity: 0.9 }),
    ];

    const world = buildCharacterMarkerDescriptors(characters, "Tous", 1.7);
    const zeusGroup = world.find((marker) => marker.representative.id === "zeus");
    assert.ok(zeusGroup);
    assert.equal(zeusGroup.band, "world");
    assert.equal(zeusGroup.count, 3);
    assert.deepEqual(zeusGroup.memberIds.sort(), ["apollo", "hera", "zeus"]);
    assert.deepEqual(zeusGroup.coordinates, [22.36, 40.09]);

    const nearby = buildCharacterMarkerDescriptors(characters, "Tous", 9);
    assert.equal(nearby.length, 4);
    assert.ok(nearby.every((marker) => marker.band === "individual" && marker.count === 1));
    const dispatchOrigins = buildCharacterDispatchOrigins(world, nearby);
    assert.deepEqual(dispatchOrigins.get("character:zeus"), [22.36, 40.09]);
    assert.deepEqual(dispatchOrigins.get("character:hera"), [22.36, 40.09]);
    assert.deepEqual(dispatchOrigins.get("character:apollo"), [22.36, 40.09]);

    const onlyZeusInsideViewport = nearby.filter((marker) => marker.representative.id === "zeus");
    const dispatchDescriptors = buildDispatchRenderDescriptors(
      [zeusGroup],
      nearby,
      onlyZeusInsideViewport,
    );
    assert.deepEqual(
      dispatchDescriptors.map((marker) => marker.representative.id).sort(),
      ["apollo", "hera", "zeus"],
    );

    const source = await readFile(new URL("../features/map/character-map.tsx", import.meta.url), "utf8");
    assert.match(source, /addSource\("character-avatars"/);
    assert.doesNotMatch(source, /new maplibregl\.Marker/);
    assert.match(source, /relationStrengths\?\.\[related\.id\] \?\? 0\.6/);
    assert.match(source, /\["get", "strength"\]/);
  } finally {
    await vite.close();
  }
});
