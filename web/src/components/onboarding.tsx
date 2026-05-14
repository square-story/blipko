"use client";

import { ArrowRightIcon, SendIcon } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { completeOnboarding, generateTelegramLinkToken } from "@/lib/actions/user";

export default function Onboarding() {
  const [step, setStep] = useState(1);
  const [open, setOpen] = useState(true);
  const [telegramLoading, setTelegramLoading] = useState(false);

  const stepContent = [
    {
      title: "Welcome to Blipko",
      description:
        "Your personal finance companion for tracking debts and credits. Keep your finances organized and stress-free.",
    },
    {
      title: "Track Transactions",
      description:
        "Keep a record of every penny. Know exactly who owes you and who you owe with our intuitive transaction logging.",
    },
    {
      title: "Manage Contacts",
      description:
        "Organize your contacts and see their balance history at a glance. Never lose track of a lending or borrowing history.",
    },
    {
      title: "Stay on Top",
      description:
        "Get insights into your cash flow and never miss a payment. Blipko helps you make informed financial decisions.",
    },
    {
      title: "Connect Telegram",
      description:
        "Use Blipko as a bot on Telegram — just type to log payments, check balances, and get reminders. Tap below to link your account.",
    },
  ];

  const totalSteps = stepContent.length;
  const isTelegramStep = step === totalSteps;

  const handleContinue = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    setOpen(false);
    await completeOnboarding();
  };

  const handleOpenTelegram = async () => {
    setTelegramLoading(true);
    // Open blank window NOW (inside click handler) so browser doesn't block it as a popup
    const win = window.open("", "_blank");
    try {
      const url = await generateTelegramLinkToken();
      if (win) win.location.href = url;
      else window.location.href = url;
    } catch {
      win?.close();
    } finally {
      setTelegramLoading(false);
      await handleComplete();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="gap-0 p-0 [&>button:last-child]:text-white sm:max-w-[425px]" showCloseButton={false}>
        <div className="p-2">
          <img
            alt="Blipko Onboarding"
            className="w-full rounded-md object-cover h-[216px]"
            src="/origin/dialog-content.png"
            width={382}
            height={216}
          />
        </div>
        <div className="space-y-6 px-6 pt-3 pb-6">
          <DialogHeader>
            <DialogTitle>{stepContent[step - 1].title}</DialogTitle>
            <DialogDescription>
              {stepContent[step - 1].description}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex justify-center space-x-1.5 max-sm:order-1">
              {[...Array(totalSteps)].map((_, index) => (
                <div
                  className={cn(
                    "size-1.5 rounded-full bg-primary transition-all duration-300",
                    index + 1 === step ? "w-3 bg-primary" : "opacity-20",
                  )}
                  key={index}
                />
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={handleComplete}>
                {isTelegramStep ? "Skip" : "Skip"}
              </Button>
              {isTelegramStep ? (
                <Button
                  className="group"
                  onClick={handleOpenTelegram}
                  type="button"
                  disabled={telegramLoading}
                >
                  <SendIcon className="mr-2 size-4" aria-hidden="true" />
                  {telegramLoading ? "Opening…" : "Open Telegram Bot"}
                </Button>
              ) : (
                <Button
                  className="group"
                  onClick={handleContinue}
                  type="button"
                >
                  {step < totalSteps - 1 ? "Next" : "Next"}
                  <ArrowRightIcon
                    aria-hidden="true"
                    className="-me-1 ml-2 opacity-60 transition-transform group-hover:translate-x-0.5"
                    size={16}
                  />
                </Button>
              )}
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
