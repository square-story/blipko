
import { signInWithGoogle } from "@/actions/auth"
import { Button } from "./ui/button"
import { TextAnimate } from "./ui/text-animate"

export function SignInButton() {
    return (
        <form action={signInWithGoogle}>
            <Button type="submit" className="px-6 py-3 text-lg font-semibold rounded-full" variant="default">
                Get on the list
            </Button>
        </form>
    )
}
