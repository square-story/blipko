import Image from "next/image"
import Link from "next/link"
import { LineShadowText } from "./ui/line-shadow-text"
import { MorphingText } from "./ui/morphing-text"
import { TextAnimate } from "./ui/text-animate"

export default function HomePageClient() {
    return (
        <main className="relative" aria-label="Home Page">
            <div className="lg:pt-48 pt-28 pb-20">
                <section aria-labelledby="hero-heading">


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
                        className="w-full mx-auto text-center max-w-lg mt-4 text-wrap"
                    >
                        Automate your finances with AI, right in your chat.
                    </TextAnimate>
                    <div className="w-full flex items-center justify-center mt-4 ">

                    </div>
                </section>
                <div className="mt-100 flex items-center justify-center px-4 pb-8 sm:px-6 lg:px-8 xl:px-0">

                </div>
            </div>
        </main>
    )
}