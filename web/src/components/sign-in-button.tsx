
import { signIn } from "@/auth"
import { Button } from "./ui/button"

export function SignInButton() {
    return (
        <form
            action={async () => {
                "use server"
                await signIn("google")
            }}
        >
            <Button type="submit" className="px-6 py-3 text-lg font-semibold rounded-full" variant="default">
                Get on the list
            </Button>
        </form>
    )
}
