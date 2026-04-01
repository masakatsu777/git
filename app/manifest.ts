import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GIT Members",
    short_name: "GIT Members",
    description: "評価、月次PL、粗利差異、給与改定連動を一元管理する社内Webシステム",
    start_url: "/login",
    scope: "/",
    display: "standalone",
    background_color: "#f8fbff",
    theme_color: "#020617",
    lang: "ja",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
