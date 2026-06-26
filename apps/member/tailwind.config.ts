import type { Config } from 'tailwindcss'
import preset from '@monobase/ui/tailwind-preset'

export default {
  presets: [preset],
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
} satisfies Omit<Config, 'content'> & { content: string[] }
