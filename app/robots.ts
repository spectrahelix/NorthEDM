import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/profile/edit", "/reset-password"],
      },
    ],
    sitemap: "https://northedm.com/sitemap.xml",
  };
}
