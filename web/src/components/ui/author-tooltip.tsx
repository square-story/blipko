"use client";


import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Drawer,
    DrawerContent,
    DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { Github, Linkedin, Twitter } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useState } from "react";

export interface Author {
    name: string;
    avatar: string;
    role: string;
    linkedin?: string;
    twitter?: string;
    github?: string;
}

interface AuthorTooltipProps {
    author: Author;
    avatarSize?: "sm" | "md" | "lg";
    avatarClassName?: string;
    isAvatarVisible?: boolean;
}

const sizeMap = {
    sm: "h-8 w-8",
    md: "h-10 w-10",
    lg: "h-12 w-12",
};

function getInitials(name: string) {
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

function AuthorContent({ author, inverted = false }: { author: Author; inverted?: boolean }) {
    const iconClass = inverted
        ? "text-background hover:text-muted-foreground transition-colors"
        : "text-foreground hover:text-muted-foreground transition-colors";

    return (
        <div className="flex flex-row items-center gap-3 p-3">
            <Avatar className="h-10 w-10">
                <AvatarImage src={author.avatar} alt={author.name} />
                <AvatarFallback>{getInitials(author.name)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
                <span className="text-sm font-medium">{author.name}</span>
                <span className="text-xs text-muted-foreground">{author.role}</span>
            </div>
            {(author.linkedin || author.twitter || author.github) && (
                <div className="ml-4 flex gap-2.5">
                    {author.linkedin && (
                        <a
                            href={author.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={iconClass}
                        >
                            <Linkedin className="h-5 w-5" />
                        </a>
                    )}
                    {author.twitter && (
                        <a
                            href={author.twitter}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={iconClass}
                        >
                            <Twitter className="h-5 w-5" />
                        </a>
                    )}
                    {author.github && (
                        <a
                            href={author.github}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={iconClass}
                        >
                            <Github className="h-5 w-5" />
                        </a>
                    )}
                </div>
            )}
        </div>
    );
}

export function AuthorTooltip({
    author,
    avatarSize = "sm",
    avatarClassName = "cursor-help border-2 border-border",
    isAvatarVisible = false,
}: AuthorTooltipProps) {
    const isDesktop = useMediaQuery("(min-width: 768px)");
    const [isOpen, setIsOpen] = useState(false);

    const triggerContent = isAvatarVisible ? (
        <Avatar className={cn(sizeMap[avatarSize], avatarClassName)}>
            <AvatarImage src={author.avatar} alt={author.name} />
            <AvatarFallback>{getInitials(author.name)}</AvatarFallback>
        </Avatar>
    ) : (
        <button
            type="button"
            className="text-primary hover:underline cursor-pointer bg-transparent border-0 p-0 text-base font-normal"
        >
            {author.name}
        </button>
    );

    if (isDesktop) {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    {isAvatarVisible ? (
                        triggerContent
                    ) : (
                        <a className="text-primary hover:underline" href={author.linkedin} target="_blank" rel="noopener noreferrer">
                            {author.name}
                        </a>
                    )}
                </TooltipTrigger>
                <TooltipContent className="p-0 rounded-xl">
                    <AuthorContent author={author} inverted />
                </TooltipContent>
            </Tooltip>
        );
    }

    return (
        <Drawer open={isOpen} onOpenChange={setIsOpen}>
            <DrawerTrigger asChild>
                {triggerContent}
            </DrawerTrigger>
            <DrawerContent>
                <div className="mx-auto w-full max-w-sm pb-4">
                    <AuthorContent author={author} />
                </div>
            </DrawerContent>
        </Drawer>
    );
}
