/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        serrano: {
          50: '#FDF7F4',
          100: '#F9ECE5',
          200: '#F2D3C4',
          300: '#EAB49E',
          400: '#DF8A6C',
          500: '#D35F3B',
          600: '#C14B27',
          700: '#9E391B',
          800: '#7E2F17',
          900: '#642714',
        },
        concrete: {
          50: '#FAF8F5',
          100: '#F4EFEA',
          200: '#E8E1D7',
          300: '#D5CBBF',
          400: '#B8ABA0',
          500: '#958579',
          600: '#75665C',
          700: '#5A4E46',
          800: '#3D342E',
          900: '#231D19',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}
