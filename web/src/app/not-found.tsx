import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">Page not found</p>
      <Link href="/dashboard" className="text-sm underline text-primary hover:opacity-80">
        Go to dashboard
      </Link>
    </div>
  );
}
