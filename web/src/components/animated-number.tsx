"use client";

import { useEffect, useState } from "react";
import NumberFlow, { NumberFlowProps } from "@number-flow/react";

export function AnimatedNumber({ value, ...props }: NumberFlowProps & { value: number }) {
    const [displayValue, setDisplayValue] = useState<number>(0);

    useEffect(() => {
        setDisplayValue(value);
    }, [value]);

    const flow = <NumberFlow value={displayValue} {...props} />;

    // Money gets a wrapper for privacy mode to blur. NumberFlow is a custom
    // element with a shadow root, so the mark has to sit outside it.
    return props.format?.style === "currency" ? (
        <span data-money>{flow}</span>
    ) : (
        flow
    );
}
