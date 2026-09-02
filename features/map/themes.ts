import type { Map as MapLibreMap } from "maplibre-gl";

export type MapThemeId = "lagon" | "pastel" | "atlas" | "graphite" | "nuit";

export const mapThemes: Array<{
  id: MapThemeId;
  label: string;
  description: string;
  swatches: [string, string, string];
}> = [
  { id: "lagon", label: "Lagon illustré", description: "Turquoise, ivoire et corail", swatches: ["#80d5dd", "#f5f2df", "#f5a28c"] },
  { id: "pastel", label: "Monde pastel", description: "Lavande, rose et menthe", swatches: ["#cad7ff", "#f3def7", "#bce4cf"] },
  { id: "atlas", label: "Atlas coloré", description: "Bleu clair, sable et végétal", swatches: ["#9bcde6", "#fff2d5", "#a8d3a4"] },
  { id: "graphite", label: "Graphique clair", description: "Sobre, lisible et contemporain", swatches: ["#bdcddd", "#f5f7f9", "#8796aa"] },
  { id: "nuit", label: "Nuit électrique", description: "Bleu profond, cyan et violet", swatches: ["#071a3d", "#173556", "#766fc1"] },
];

const mapPalettes: Record<MapThemeId, {
  background: string;
  water: string;
  land: string;
  nature: string;
  building: string;
  urban: string;
  outline: string;
  boundary: string;
  roadStrong: string;
  road: string;
  waterLine: string;
  text: string;
  roadText: string;
  waterText: string;
  halo: string;
  extrusion: string;
}> = {
  lagon: {
    background: "#b5dfe5", water: "#87d4dd", land: "#f5f2df", nature: "#b8dfc2",
    building: "#ead9e0", urban: "#e7e4ee", outline: "#81afb2", boundary: "#4c8794",
    roadStrong: "#f19d89", road: "#fffaf1", waterLine: "#47aebb", text: "#284650",
    roadText: "#8b6262", waterText: "#246e7a", halo: "#f7fffd", extrusion: "#d8cddd",
  },
  pastel: {
    background: "#d8dcff", water: "#c6d8ff", land: "#f3e2f7", nature: "#c2e4d2",
    building: "#e9c6dd", urban: "#e8dced", outline: "#a68fbd", boundary: "#8165a3",
    roadStrong: "#ed91aa", road: "#fff7fc", waterLine: "#77a7df", text: "#49385e",
    roadText: "#916b8c", waterText: "#465f9b", halo: "#fff8ff", extrusion: "#d5c4e0",
  },
  atlas: {
    background: "#c6e1ed", water: "#9bcfe6", land: "#fff2d5", nature: "#a8d3a4",
    building: "#efcfc4", urban: "#e8ded4", outline: "#83a8ad", boundary: "#557f98",
    roadStrong: "#e88f72", road: "#fffdf6", waterLine: "#4c9fc0", text: "#2d4353",
    roadText: "#8b655b", waterText: "#316b88", halo: "#fffbed", extrusion: "#d8c8bc",
  },
  graphite: {
    background: "#d8e2ec", water: "#bdcedd", land: "#f4f6f8", nature: "#d3dfdb",
    building: "#cbd3dd", urban: "#e0e5eb", outline: "#9caab8", boundary: "#62778b",
    roadStrong: "#8d7899", road: "#ffffff", waterLine: "#799eb6", text: "#334354",
    roadText: "#677586", waterText: "#526f84", halo: "#ffffff", extrusion: "#bec7d1",
  },
  nuit: {
    background: "#061027", water: "#071a3d", land: "#172b4d", nature: "#123f4a",
    building: "#27385f", urban: "#1b3155", outline: "#254f70", boundary: "#6ec7db",
    roadStrong: "#766fc1", road: "#3d5f91", waterLine: "#28b6c9", text: "#c5ddf4",
    roadText: "#7891bd", waterText: "#5ec9da", halo: "#07142c", extrusion: "#263a62",
  },
};

export function stylizeWorldMap(map: MapLibreMap, theme: MapThemeId) {
  const palette = mapPalettes[theme];
  const layers = map.getStyle().layers ?? [];

  layers.forEach((layer) => {
    const id = layer.id.toLowerCase();

    if (id.startsWith("character-") || id.startsWith("relationship-")) return;

    try {
      if (layer.type === "background") {
        map.setPaintProperty(layer.id, "background-color", palette.background);
        map.setPaintProperty(layer.id, "background-opacity", 1);
      }

      if (layer.type === "fill") {
        let color = palette.land;
        let opacity = 0.94;

        if (/water|ocean|lake|river/.test(id)) {
          color = palette.water;
          opacity = 1;
        } else if (/park|wood|forest|grass|natural|landcover/.test(id)) {
          color = palette.nature;
          opacity = 0.88;
        } else if (/building/.test(id)) {
          color = palette.building;
          opacity = 0.72;
        } else if (/residential|commercial|industrial|landuse/.test(id)) {
          color = palette.urban;
          opacity = 0.82;
        }

        map.setPaintProperty(layer.id, "fill-color", color);
        map.setPaintProperty(layer.id, "fill-opacity", opacity);
        map.setPaintProperty(layer.id, "fill-outline-color", palette.outline);
      }

      if (layer.type === "line") {
        let color = palette.outline;
        let opacity = 0.34;

        if (/boundary|admin|border/.test(id)) {
          color = palette.boundary;
          opacity = 0.5;
        } else if (/motorway|trunk|primary/.test(id)) {
          color = palette.roadStrong;
          opacity = 0.48;
        } else if (/road|street|path|rail/.test(id)) {
          color = palette.road;
          opacity = 0.32;
        } else if (/water|river|stream/.test(id)) {
          color = palette.waterLine;
          opacity = 0.58;
        }

        map.setPaintProperty(layer.id, "line-color", color);
        map.setPaintProperty(layer.id, "line-opacity", opacity);
      }

      if (layer.type === "symbol") {
        const textColor = /water|ocean|river|lake/.test(id)
          ? palette.waterText
          : /road|highway/.test(id)
            ? palette.roadText
            : palette.text;
        map.setPaintProperty(layer.id, "text-color", textColor);
        map.setPaintProperty(layer.id, "text-halo-color", palette.halo);
        map.setPaintProperty(layer.id, "text-halo-width", 1.15);
        map.setPaintProperty(layer.id, "text-opacity", /road|highway/.test(id) ? 0.58 : 0.82);
      }

      if (layer.type === "fill-extrusion") {
        map.setPaintProperty(layer.id, "fill-extrusion-color", palette.extrusion);
        map.setPaintProperty(layer.id, "fill-extrusion-opacity", 0.66);
      }
    } catch {
      // Some source styles expose a property only at certain zoom levels.
    }
  });
}
