import { LineShadowText } from "./ui/line-shadow-text"
import { TextAnimate } from "./ui/text-animate"
import { Button } from "./ui/button"
import { FaqsSection } from "./faqs-section"
import { GravityStarsBackground } from "../components/animate-ui/components/backgrounds/gravity-stars"

export default function HomePageClient() {
    return (
        <main className="relative" aria-label="Home Page">
            <GravityStarsBackground movementSpeed={0.5} className="fixed inset-0 -z-10" />
            <div className="lg:pt-48 pt-28 pb-40 relative">
                <section aria-labelledby="hero-heading" className="relative z-10">
                    <h1
                        id="hero-heading"
                        className="text-5xl leading-none font-semibold tracking-tighter text-balance sm:text-6xl md:text-7xl lg:text-8xl text-center"
                    >
                        <LineShadowText className="italic">
                            Blipko
                        </LineShadowText>
                    </h1>

                    <TextAnimate
                        animation="blurInUp"
                        by="character"
                        once
                        className="w-full mx-auto text-center max-w-5xl mt-4 text-wrap"
                    >
                        Manage money as easy as chat.
                    </TextAnimate>
                    <div className="w-full flex items-center justify-center mt-4">
                        <Button
                            className="px-6 py-3 text-lg font-semibold rounded-full"
                            variant="default"
                        >
                            Get on the list
                        </Button>
                    </div>
                </section>
                <div className="mt-20 flex items-center justify-center px-4 pb-8 sm:px-6 lg:px-8 xl:px-0">
                    <FaqsSection />
                </div>
            </div>
        </main>
    )
}