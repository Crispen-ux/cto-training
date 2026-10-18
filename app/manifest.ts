import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Personal CTO Academy",
    short_name: "CTO Academy",
    description: "Learn the framework. Build real systems. Defend your decisions. Prove your competence.",
    start_url: "/",
    display: "standalone",
    background_color: "#0f1419",
    theme_color: "#4fb3a5",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
