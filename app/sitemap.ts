import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

/** Sitemap do site comercial. A área logada fica fora do índice. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: site.url,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${site.url}/privacidade`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${site.url}/login`,
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];
}
