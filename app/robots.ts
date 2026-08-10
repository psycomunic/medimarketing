import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

/** A área logada (/app) nunca deve ser indexada. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app", "/app/"],
    },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
