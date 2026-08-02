import { constructMetadata } from "@/lib/seo";

// page.tsx is "use client" (scroll-spy + motion), so it can't export metadata.
// Without this the page inherits the root's canonical and tells crawlers it's a
// duplicate of the homepage.
export const metadata = constructMetadata({
  title: "Privacy Policy",
  description:
    "What data Blipko collects, which services receive it, how long it's kept, and how to get it deleted.",
  canonical: "/privacy-policy",
});

export default function PrivacyPolicyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
