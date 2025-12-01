import { Footer } from "@/components/Footer";
import { Header } from "@/components/Navbar";

export default function MarketingLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <>
            <header>
                <nav>
                    <Header />
                </nav>
            </header>
            {children}
            <footer>
                <Footer />
            </footer>
        </>
    );
}
