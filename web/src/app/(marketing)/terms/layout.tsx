import { constructMetadata } from "@/lib/seo";

// page.tsx is "use client" (scroll-spy + motion), so it can't export metadata.
// Without this the page inherits the root's canonical and tells crawlers it's a
// duplicate of the homepage.
export const metadata = constructMetadata({
  title: "Terms of Service",
  description:
    "The terms you agree to when using Blipko — what the service does, acceptable use, and how to close your account.",
  canonical: "/terms",
});

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
