import { Footer } from "@/components/Footer";
import { Header } from "@/components/Navbar";

export default function MarketingLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <>
            <Header />
            {children}
            <footer>
                <Footer />
            </footer>
        </>
    );
}
