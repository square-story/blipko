"use client";

import { useEffect, useState } from "react";
import NumberFlow, { NumberFlowProps } from "@number-flow/react";

export function AnimatedNumber({ value, ...props }: NumberFlowProps & { value: number }) {
    const [displayValue, setDisplayValue] = useState<number>(0);

    useEffect(() => {
        setDisplayValue(value);
    }, [value]);

    return <NumberFlow value={displayValue} {...props} />;
}
