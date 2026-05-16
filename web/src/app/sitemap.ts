import type { MetadataRoute } from "next";
import { siteConfig } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
    return [
        {
            url: siteConfig.url,
            lastModified: new Date(),
            changeFrequency: "weekly",
            priority: 1,
        },
        {
            url: `${siteConfig.url}/privacy-policy`,
            lastModified: new Date("2026-05-16"),
            changeFrequency: "monthly",
            priority: 0.5,
        },
        {
            url: `${siteConfig.url}/terms`,
            lastModified: new Date("2026-05-16"),
            changeFrequency: "monthly",
            priority: 0.5,
        },
    ];
}
