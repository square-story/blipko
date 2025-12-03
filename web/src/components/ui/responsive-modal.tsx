"use client"

import * as React from "react"
import { useMediaQuery } from "@/hooks/use-media-query"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer"

const ResponsiveModalContext = React.createContext<{ isDesktop: boolean }>({
    isDesktop: false,
})

const useResponsiveModal = () => React.useContext(ResponsiveModalContext)

export const ResponsiveModal = ({ children, ...props }: React.ComponentProps<typeof Dialog>) => {
    const isDesktop = useMediaQuery("(min-width: 768px)")
    const Modal = isDesktop ? Dialog : Drawer

    return (
        <ResponsiveModalContext.Provider value={{ isDesktop }}>
            <Modal {...props}>{children}</Modal>
        </ResponsiveModalContext.Provider>
    )
}

export const ResponsiveModalTrigger = ({ children, ...props }: React.ComponentProps<typeof DialogTrigger>) => {
    const { isDesktop } = useResponsiveModal()
    const Trigger = isDesktop ? DialogTrigger : DrawerTrigger
    return <Trigger {...props}>{children}</Trigger>
}

export const ResponsiveModalContent = ({ children, className, ...props }: React.ComponentProps<typeof DialogContent>) => {
    const { isDesktop } = useResponsiveModal()

    if (isDesktop) {
        return (
            <DialogContent className={className} {...props}>
                {children}
            </DialogContent>
        )
    }

    return (
        <DrawerContent className={className} {...props}>
            {children}
        </DrawerContent>
    )
}

export const ResponsiveModalHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
    const { isDesktop } = useResponsiveModal()
    const Header = isDesktop ? DialogHeader : DrawerHeader
    return <Header className={className} {...props} />
}

export const ResponsiveModalTitle = ({ className, ...props }: React.ComponentProps<typeof DialogTitle>) => {
    const { isDesktop } = useResponsiveModal()
    const Title = isDesktop ? DialogTitle : DrawerTitle
    return <Title className={className} {...props} />
}

export const ResponsiveModalDescription = ({ className, ...props }: React.ComponentProps<typeof DialogDescription>) => {
    const { isDesktop } = useResponsiveModal()
    const Description = isDesktop ? DialogDescription : DrawerDescription
    return <Description className={className} {...props} />
}

export const ResponsiveModalFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
    const { isDesktop } = useResponsiveModal()
    const Footer = isDesktop ? DialogFooter : DrawerFooter
    return <Footer className={className} {...props} />
}
