import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface TestimonialCardProps {
    title: string;
    content: string;
    author: string;
    date: string;
    rating?: number;
    className?: string;
}

export const TestimonialCard = ({
    title,
    content,
    author,
    date,
    rating = 5,
    className
}: TestimonialCardProps) => {
    return (
        <div className={cn(
            "bg-[#111] border border-white/10 rounded-2xl p-6 max-w-xl w-full text-left",
            className
        )}>
            <div className="flex justify-between items-start mb-4">
                <h3 className="text-white font-semibold text-lg">{title}</h3>
                <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                            key={i}
                            size={16}
                            className={cn(
                                "fill-yellow-500 text-yellow-500",
                                i >= rating && "fill-transparent text-gray-600"
                            )}
                        />
                    ))}
                </div>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-6">
                {content}
            </p>
            <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>by <span className="text-gray-300">{author}</span></span>
                <span>·</span>
                <span>{date}</span>
            </div>
        </div>
    );
};
