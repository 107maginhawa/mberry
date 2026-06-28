import { type ClassValue, clsx } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// The design system adds custom font sizes (amount/title/section/large/body/
// caption — see tailwind-preset.ts). tailwind-merge doesn't know these are
// font-size utilities, so a class like `text-body` lands in the same ambiguous
// "text-*" bucket as `text-primary-foreground` (a COLOR) and silently wins,
// stripping the color. That turned the Pay-now CTA into near-black-on-plum.
// Registering them as font-size keeps size and color in separate groups.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["amount", "title", "section", "large", "body", "caption"] },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
