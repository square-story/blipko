import { Construction } from "lucide-react";

export function ComingSoon() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] p-8 text-center rounded-lg border border-dashed bg-muted/50">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                <Construction className="h-10 w-10 text-muted-foreground" />
            </div>
            <h2 className="mt-6 text-2xl font-semibold tracking-tight">
                Coming Soon
            </h2>
            <p className="mt-2 text-center text-muted-foreground max-w-sm">
                We are working hard to bring you this feature. Stay tuned for updates!
            </p>
        </div>
    );
}
