
import { Play } from "lucide-react"
import Link from "next/link"

export function WatchDemoButton() {
    return (
        <Link href="https://www.linkedin.com/posts/sadikkp_blipko-productlaunch-indiehacker-ugcPost-7401264844164730881-mF-5?utm_source=share&utm_medium=member_desktop&rcm=ACoAACASDssBQL7-MI5bgK8_8UkKIQg1seoVtSg" target="_blank">
            <button
                className="group relative flex h-12 w-[200px] items-center justify-between rounded-full font-medium border-2 text-primary"
            >
                <span className="pl-4">Watch Demo</span>
                <div className="relative mr-1 h-9 w-9 overflow-hidden rounded-full bg-primary border border-primary">
                    <Play className="h-4 w-4 ml-2 mt-2 text-accent" />
                </div>
            </button>
        </Link>
    )
}
