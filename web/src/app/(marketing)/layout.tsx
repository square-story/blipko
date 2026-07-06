import { Footer } from "@/components/Footer";

export default function MarketingLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <>
            {children}
            <footer>
                <Footer />
            </footer>
        </>
    );
}
