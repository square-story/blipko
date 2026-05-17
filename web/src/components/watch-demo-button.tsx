import { Play } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export function WatchDemoButton() {
    return (
        <Button asChild size="lg" variant="outline" className="rounded-full">
            <Link href="https://youtu.be/YjKOqf2Cpjw" target="_blank">
                <Play data-icon="inline-start" />
                Watch Demo
            </Link>
        </Button>
    )
}
