import { auth } from "@/auth"
import { HomeContent } from "./home-content"

export default async function HomePageClient() {
    const session = await auth()

    return <HomeContent session={session} />;
}