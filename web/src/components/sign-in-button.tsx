
import { signInWithGoogle } from "@/actions/auth"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export function SignInButton() {
    return (
        <form action={signInWithGoogle}>
            <Button size="lg" className="rounded-full">
                Get Early Access
                <ArrowRight data-icon="inline-end" />
            </Button>
        </form>
    )
}
