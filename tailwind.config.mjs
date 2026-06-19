import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import forms from '@tailwindcss/forms'
import typography from '@tailwindcss/typography'
import plugin from 'tailwindcss/plugin.js'
import {
  generateColorPalette,
  generateCSSVariables,
  generateSemanticColors,
} from './node_modules/frappe-ui/tailwind/colorPalette.js'

const require = createRequire(import.meta.url)
const iconDir = path.join(
  path.dirname(require.resolve('lucide-static/package.json')),
  'icons',
)

const colorPalette = generateColorPalette()
const semanticColors = generateSemanticColors()
const cssVariables = generateCSSVariables()

const frappeThemePlugin = plugin(
  ({ addBase, addComponents, theme }) => {
    addBase({
      html: {
        'font-family': `Inter, ${theme('fontFamily.sans')}`,
        'font-optical-sizing': 'auto',
      },
      'html, body, button, p, span, div': {
        fontVariationSettings: "'opsz' 24, 'cv11' 1",
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      },
      select: {
        backgroundImage:
          'url(\'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="%237C7C7C" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" aria-hidden="true" viewBox="0 0 24 24" ><path d="m6 9 6 6 6-6" /></svg>\')',
        backgroundSize: '1.13em',
        backgroundPosition: 'right 0.44rem center',
      },
      ...cssVariables,
    })
    addComponents({
      '.form-input, .form-textarea, .form-select': {
        '@apply h-7 rounded border border-[--surface-gray-2] bg-surface-gray-2 py-1.5 pl-2 pr-2 text-base text-ink-gray-8 placeholder-ink-gray-4 transition-colors hover:border-outline-gray-modals hover:bg-surface-gray-3 focus:border-outline-gray-4 focus:bg-surface-white focus:shadow-sm focus:ring-0 focus-visible:ring-2 focus-visible:ring-outline-gray-3':
          {},
      },
      '.form-checkbox': {
        '@apply rounded-md bg-surface-gray-2 text-ink-blue-2 focus:ring-0 focus-visible:ring-1':
          {},
      },
    })
  },
  {
    theme: {
      colors: colorPalette,
      borderRadius: {
        none: '0px',
        sm: '0.25rem',
        DEFAULT: '0.5rem',
        md: '0.625rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.25rem',
        full: '9999px',
      },
      boxShadow: {
        sm: '0px 1px 2px rgba(0, 0, 0, 0.1)',
        DEFAULT: '0px 0px 1px rgba(0, 0, 0, 0.45), 0px 1px 2px rgba(0, 0, 0, 0.1)',
        md: '0px 0px 1px rgba(0, 0, 0, 0.12), 0px 0.5px 2px rgba(0, 0, 0, 0.15), 0px 2px 3px rgba(0, 0, 0, 0.16)',
        lg: '0px 0px 1px rgba(0, 0, 0, 0.35), 0px 6px 8px -4px rgba(0, 0, 0, 0.1)',
        xl: '0px 0px 1px rgba(0, 0, 0, 0.19), 0px 1px 2px rgba(0, 0, 0, 0.07), 0px 6px 15px -5px rgba(0, 0, 0, 0.11)',
        '2xl': '0px 0px 1px rgba(0, 0, 0, 0.2), 0px 1px 3px rgba(0, 0, 0, 0.05), 0px 10px 24px -3px rgba(0, 0, 0, 0.1)',
        none: 'none',
      },
      fontSize: {
        '2xs': ['11px', { lineHeight: '1.15', letterSpacing: '0', fontWeight: '420' }],
        xs: ['12px', { lineHeight: '1.15', letterSpacing: '0', fontWeight: '420' }],
        sm: ['13px', { lineHeight: '1.15', letterSpacing: '0', fontWeight: '420' }],
        base: ['14px', { lineHeight: '1.15', letterSpacing: '0', fontWeight: '420' }],
        lg: ['16px', { lineHeight: '1.15', letterSpacing: '0', fontWeight: '400' }],
        xl: ['18px', { lineHeight: '1.15', letterSpacing: '0', fontWeight: '400' }],
        '2xl': ['20px', { lineHeight: '1.15', letterSpacing: '0', fontWeight: '400' }],
        '3xl': ['24px', { lineHeight: '1.15', letterSpacing: '0', fontWeight: '400' }],
        'p-2xs': ['11px', { lineHeight: '1.6', letterSpacing: '0', fontWeight: '420' }],
        'p-xs': ['12px', { lineHeight: '1.6', letterSpacing: '0', fontWeight: '420' }],
        'p-sm': ['13px', { lineHeight: '1.5', letterSpacing: '0', fontWeight: '420' }],
        'p-base': ['14px', { lineHeight: '1.5', letterSpacing: '0', fontWeight: '420' }],
        'p-lg': ['16px', { lineHeight: '1.5', letterSpacing: '0', fontWeight: '400' }],
        'p-xl': ['18px', { lineHeight: '1.42', letterSpacing: '0', fontWeight: '400' }],
        'p-2xl': ['20px', { lineHeight: '1.38', letterSpacing: '0', fontWeight: '400' }],
        'p-3xl': ['24px', { lineHeight: '1.2', letterSpacing: '0', fontWeight: '400' }],
      },
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
      },
      extend: {
        fontFamily: {
          sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        },
        textColor: {
          ink: semanticColors.ink,
        },
        backgroundColor: {
          surface: semanticColors.surface,
        },
        fill: {
          ink: semanticColors.ink,
          surface: semanticColors.surface,
        },
        stroke: {
          ink: semanticColors.ink,
        },
        placeholderColor: {
          ink: semanticColors.ink,
        },
        borderColor: () => ({
          DEFAULT: 'var(--outline-gray-1)',
          outline: semanticColors.outline,
        }),
        ringColor: {
          outline: semanticColors.outline,
        },
        divideColor: {
          outline: semanticColors.outline,
        },
        spacing: {
          4.5: '1.125rem',
          5.5: '1.375rem',
          6.5: '1.625rem',
          7.5: '1.875rem',
          8.5: '2.125rem',
          9.5: '2.375rem',
          10.5: '2.625rem',
          11.5: '2.875rem',
          12.5: '3.125rem',
          13: '3.25rem',
          13.5: '3.375rem',
          14.5: '3.625rem',
          15: '3.75rem',
          15.5: '3.875rem',
        },
        width: {
          3.5: '0.875rem',
          112: '28rem',
          wizard: '650px',
        },
        height: {
          3.5: '0.875rem',
        },
        minWidth: {
          40: '10rem',
          50: '18rem',
        },
        maxHeight: {
          52: '13rem',
        },
      },
    },
  },
)

const lucideMaskPlugin = plugin(({ matchComponents }) => {
  const names = fs
    .readdirSync(iconDir)
    .filter((file) => file.endsWith('.svg'))
    .map((file) => file.replace(/\.svg$/, ''))
  const values = Object.fromEntries(names.map((name) => [name, name]))

  matchComponents(
    {
      lucide: (name) => {
        const filePath = path.join(iconDir, `${name}.svg`)
        if (!fs.existsSync(filePath)) return {}
        const svg = fs
          .readFileSync(filePath, 'utf8')
          .replace(/stroke-width="[^"]+"/, 'stroke-width="1.5"')
          .replace(/\s+/g, ' ')
          .trim()
        const uri = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
        return {
          display: 'inline-block',
          width: '1em',
          height: '1em',
          backgroundColor: 'currentColor',
          maskImage: `url("${uri}")`,
          maskRepeat: 'no-repeat',
          maskPosition: 'center',
          maskSize: 'contain',
          WebkitMaskImage: `url("${uri}")`,
          WebkitMaskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          WebkitMaskSize: 'contain',
        }
      },
    },
    { values },
  )
})

export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: [
    './index.html',
    './src/**/*.{vue,ts}',
    './node_modules/frappe-ui/src/**/*.{vue,js,ts}',
  ],
  plugins: [forms, typography, frappeThemePlugin, lucideMaskPlugin],
  theme: {
    extend: {
      colors: {
        ledger: {
          ink: '#1f2933',
          pine: '#0f766e',
          mint: '#d9f4ec',
          saffron: '#f7b955',
          coral: '#e76f51',
          cloud: '#f7faf9',
        },
      },
    },
  },
}
