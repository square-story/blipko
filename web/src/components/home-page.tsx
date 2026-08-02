import { auth } from "@/auth"
import { getLatestChangelogEntry } from "@/lib/changelog"
import { HomeContent } from "./home-content"

export default async function HomePageClient() {
    const session = await auth()
    const latest = getLatestChangelogEntry()

    // Only the serializable bits — `Content` is a compiled MDX component and
    // can't cross into a client component.
    return (
        <HomeContent
            session={session}
            latestChangelog={
                latest ? { slug: latest.slug, date: latest.date } : null
            }
        />
    );
}
