import type { MetadataRoute } from "next";
import { studioConfig } from "./studio-config";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${studioConfig.publicationName} Studio`,
    short_name: studioConfig.publicationName,
    description: `A private place to write and publish ${studioConfig.publicationName}.`,
    start_url: "/",
    display: "standalone",
    background_color: "#f4eddf",
    theme_color: "#f4eddf",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
