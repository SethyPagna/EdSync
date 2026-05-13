import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Bricolage Grotesque', 'sans-serif'],
        body: ['Instrument Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        edsync: {
          bg: 'var(--bg)',
          surface: 'var(--surface)',
          card: 'var(--card)',
          border: 'var(--border)',
          muted: 'var(--muted)',
          text: 'var(--text)',
          subtle: 'var(--subtle)',
          blue: 'rgb(var(--blue-rgb) / <alpha-value>)',
          'blue-dim': '#dbe8ff',
          amber: 'rgb(var(--amber-rgb) / <alpha-value>)',
          'amber-dim': '#fff3d6',
          emerald: 'rgb(var(--emerald-rgb) / <alpha-value>)',
          'emerald-dim': '#dff8ef',
          red: 'rgb(var(--red-rgb) / <alpha-value>)',
          'red-dim': '#fee2e2',
          cyan: 'rgb(var(--cyan-rgb) / <alpha-value>)',
          purple: 'rgb(var(--purple-rgb) / <alpha-value>)',
        }
      },
      backgroundImage: {
        'grid-pattern': "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%231F2937' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glow-blue': 'radial-gradient(ellipse at center, rgba(79,134,247,0.15) 0%, transparent 70%)',
        'glow-amber': 'radial-gradient(ellipse at center, rgba(245,166,35,0.15) 0%, transparent 70%)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { transform: 'translateY(20px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        glow: { '0%': { boxShadow: '0 0 5px rgba(79,134,247,0.3)' }, '100%': { boxShadow: '0 0 20px rgba(79,134,247,0.6)' } },
      },
      boxShadow: {
        'glow-blue': '0 0 20px rgba(79, 134, 247, 0.3)',
        'glow-amber': '0 0 20px rgba(245, 166, 35, 0.3)',
        'glow-emerald': '0 0 20px rgba(35, 209, 139, 0.3)',
        'card': '0 1px 3px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.6)',
        'card-hover': '0 4px 20px rgba(0,0,0,0.6), 0 0 0 1px rgba(79,134,247,0.2)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}

export default config
