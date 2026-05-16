import { Metadata } from "next";

export const siteConfig = {
  name: "Blipko",
  shortName: "Blipko",
  description:
    "Track money on Telegram in Malayalam, Manglish, or English. Log payments, split bills, set rent reminders, and manage family finances — just by chatting. Built for Kerala.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://blipko.app",
  ogImage: "/opengraph-image.png",
  keywords: [
    "expense tracker Malayalam",
    "Telegram finance bot Kerala",
    "Manglish accounting",
    "family expense tracker India",
    "rent reminder bot",
    "debt tracker Telegram",
    "Kerala personal finance app",
    "voice note expense tracker",
    "ഹിസാബ് ട്രാക്കർ",
    "Indian rupee tracker",
  ],
  authors: [
    {
      name: "Blipko",
      url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://blipko.app",
    },
  ],
  creator: "Blipko",
  publisher: "Blipko",
  category: "Finance",
  links: {
    github: "https://github.com/square-story/blipko",
    twitter: "https://twitter.com/SadikBuilds",
  },
};

export function constructMetadata({
  title = siteConfig.name,
  description = siteConfig.description,
  image = siteConfig.ogImage,
  canonical = "",
  noIndex = false,
  keywords = siteConfig.keywords,
}: {
  title?: string;
  description?: string;
  image?: string;
  canonical?: string;
  noIndex?: boolean;
  keywords?: string[];
} = {}): Metadata {
  const canonicalUrl = canonical
    ? `${siteConfig.url}${canonical}`
    : siteConfig.url;
  const imageUrl = image.startsWith("http")
    ? image
    : `${siteConfig.url}${image}`;

  return {
    metadataBase: new URL(siteConfig.url),
    title: {
      default: title,
      template: `%s | ${siteConfig.shortName}`,
    },
    description,
    keywords,
    authors: siteConfig.authors,
    creator: siteConfig.creator,
    publisher: siteConfig.publisher,
    category: siteConfig.category,
    applicationName: siteConfig.name,

    // Robots
    robots: {
      index: !noIndex,
      follow: !noIndex,
      googleBot: {
        index: !noIndex,
        follow: !noIndex,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },

    // Open Graph
    openGraph: {
      type: "website",
      locale: "en_US",
      url: canonicalUrl,
      title,
      description,
      siteName: siteConfig.name,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
          type: "image/png",
        },
      ],
    },

    // Twitter
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
      creator: "@SadikBuilds",
      site: "@SadikBuilds",
    },

    // Verification
    verification: {
      google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
      yandex: process.env.NEXT_PUBLIC_YANDEX_VERIFICATION,
      other: {
        "msvalidate.01": process.env.NEXT_PUBLIC_BING_VERIFICATION || "",
      },
    },

    // Alternates
    alternates: {
      canonical: canonicalUrl,
    },

    // Additional metadata
    other: {
      "apple-mobile-web-app-capable": "yes",
      "apple-mobile-web-app-status-bar-style": "black-translucent",
      "format-detection": "telephone=no",
    },
  };
}

// Structured Data helpers
export function generateOrganizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.name,
    url: siteConfig.url,
    logo: `${siteConfig.url}/Square.png`,
    description: siteConfig.description,
    sameAs: [siteConfig.links.twitter, siteConfig.links.github],
    founder: {
      "@type": "Person",
      name: "sadik",
      email: "sadik.build@gmail.com",
    },
  };
}

export function generateWebsiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteConfig.url}/?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function generateWebApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web Browser",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    screenshot: [
      `${siteConfig.url}/screenshot01.png`,
      `${siteConfig.url}/screenshot02.png`,
    ],
  };
}

export function generateBreadcrumbSchema(
  items: { name: string; url: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${siteConfig.url}${item.url}`,
    })),
  };
}

export function generateFAQSchema(
  faqs: { question: string; answer: string }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function generateSoftwareApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: siteConfig.name,
    applicationCategory: "FinanceApplication",
    applicationSubCategory: "Digital Accountant",
    operatingSystem: "Any",
    url: siteConfig.url,
    description: siteConfig.description,
    screenshot: [
      `${siteConfig.url}/screenshot01.png`,
      `${siteConfig.url}/screenshot02.png`,
    ],
    image: `${siteConfig.url}/opengraph-image.png`,
    author: {
      "@type": "Organization",
      name: siteConfig.creator,
      url: siteConfig.url,
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
    },
    softwareVersion: "1.0",
    datePublished: "2025-01-01",
    license: "https://opensource.org/licenses/MIT",
    requirementsUrl: `${siteConfig.url}`,
    downloadUrl: `${siteConfig.url}`,
    installUrl: `${siteConfig.url}`,
    browserRequirements: "Requires JavaScript. Requires HTML5.",
    featureList: [
      "Telegram bot interface",
      "Malayalam and Manglish voice notes",
      "Split bill tracking",
      "Recurring rent and dues reminders",
      "Family group expense sharing",
      "Multi-wallet management",
      "AI-powered queries",
      "Daily and monthly summaries",
    ],
    keywords: siteConfig.keywords.join(", "),
  };
}
