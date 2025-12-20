'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import { motion, useMotionValue, useSpring } from 'framer-motion';

interface EyeProps {
    cx: string; // Center X as percentage
    cy: string; // Center Y as percentage
    radius: number; // Radius of the eyeball in pixels (visual)
    pupilRadius: number; // Radius of the pupil in pixels
}

const springs = { stiffness: 150, damping: 15, mass: 0.1 };

const Eye = ({ cx, cy, radius, pupilRadius }: EyeProps) => {
    const eyeRef = useRef<SVGSVGElement>(null);

    // Motion values for target position
    const targetX = useMotionValue(0);
    const targetY = useMotionValue(0);

    // Spring values for smooth animation
    const x = useSpring(targetX, springs);
    const y = useSpring(targetY, springs);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!eyeRef.current) return;

            const eyeRect = eyeRef.current.getBoundingClientRect();
            const eyeCenterX = eyeRect.left + eyeRect.width / 2;
            const eyeCenterY = eyeRect.top + eyeRect.height / 2;

            // Vector from eye center to mouse
            const dx = e.clientX - eyeCenterX;
            const dy = e.clientY - eyeCenterY;

            // Calculate angle
            const angle = Math.atan2(dy, dx);

            // Constraint logic
            const maxMove = radius - pupilRadius;
            const rawDist = Math.sqrt(dx * dx + dy * dy);

            // Smooth look-at behavior:
            // Track closer when near, clamp when far
            const moveDist = Math.min(rawDist, maxMove);

            const moveX = Math.cos(angle) * moveDist;
            const moveY = Math.sin(angle) * moveDist;

            targetX.set(moveX);
            targetY.set(moveY);
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [radius, pupilRadius, targetX, targetY]);

    return (
        <svg
            ref={eyeRef}
            className="absolute overflow-visible"
            style={{
                left: cx,
                top: cy,
                width: radius * 2,
                height: radius * 2,
                transform: 'translate(-50%, -50%)',
            }}
            viewBox={`0 0 ${radius * 2} ${radius * 2}`}
        >
            {/* Debug/Structure: The 'eyeball' is effectively invisible/white on top of white eye, 
                but good for structure. We could make it transparent if underlying image dictates. */}
            {/* <circle cx={radius} cy={radius} r={radius} fill="white" className="opacity-0" /> */}

            <motion.circle
                cx={radius}
                cy={radius}
                r={pupilRadius}
                fill="#0D0D20"
                style={{ x, y }}
            />
            {/* Glare effect for "icon" feel - optional but adds life */}
            <motion.circle
                cx={radius + pupilRadius * 0.4}
                cy={radius - pupilRadius * 0.4}
                r={pupilRadius * 0.3}
                fill="white"
                style={{ x, y }}
                opacity={0.8}
            />
        </svg>
    );
};

interface EyeTrackingCharacterProps {
    className?: string;
    size?: number;
}

export const EyeTrackingCharacter = ({ className, size = 64 }: EyeTrackingCharacterProps) => {
    // Default size 64px (h-16 w-16 equivalent)
    // We scale the SVG content based on the size prop

    // Scale factor to adjust internal pixel values if size changes? 
    // Actually, simpler to just scale the whole container and let percentages work.
    // But fixed pixel radii in Eye component might need scaling.
    // Let's assume the Eye props (radius=12) were tuned for ~256px original size?
    // User had w-64 h-64 (256px).
    // If we want it to work at 64px, we need to scale everything.

    // Let's use a scale transform on the container to keep internal math simple
    // or passing a scale factor.

    const BASE_SIZE = 200;
    const scale = size / BASE_SIZE;

    return (
        <div
            className={`w-32 h-32 md:w-40 md:h-40 relative rounded-[40px] overflow-hidden shadow-2xl mb-8 border border-white/10 group animate-in fade-in zoom-in duration-700`}
            style={{ width: size, height: size }}
        >
            <Image
                src='/brand/char.png'
                alt="Character"
                fill
                className="object-contain"
                priority
            />

            <div className="absolute inset-0 pointer-events-none">
                <Eye
                    cx="30%"
                    cy="38%"
                    radius={12 * scale}
                    pupilRadius={8 * scale}
                />
                <Eye
                    cx="50%"
                    cy="38%"
                    radius={12 * scale}
                    pupilRadius={8 * scale}
                />
            </div>
        </div>
    );
};

