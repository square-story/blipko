import { auth } from "@/auth"
import { getLatestChangelogEntry } from "@/lib/changelog"
import { prisma } from "@/lib/prisma"
import { HomeContent } from "./home-content"

export default async function HomePageClient() {
    // Aggregate count only — never individual users. The hero shows a real
    // number, not invented social proof, and no personal data leaves the DB.
    const [session, userCount] = await Promise.all([
        auth(),
        prisma.user.count().catch(() => 0),
    ])
    const latest = getLatestChangelogEntry()

    // Only the serializable bits — `Content` is a compiled MDX component and
    // can't cross into a client component.
    return (
        <HomeContent
            session={session}
            userCount={userCount}
            latestChangelog={
                latest ? { slug: latest.slug, date: latest.date } : null
            }
        />
    );
}
