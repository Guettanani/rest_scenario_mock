/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fff2f2',
          100: '#ffe3e5',
          200: '#ffc9ce',
          300: '#ff9ea6',
          400: '#ff6775',
          500: '#ef4653',
          600: '#e63641',
          700: '#bf202f',
          800: '#9d1d2d',
          900: '#821d2c',
        },
        gray: {
          50: '#ffffff',
          100: '#f8f7f6',
          200: '#ece7e3',
          300: '#d9d2cc',
          400: '#b5aa9f',
          500: '#8f8276',
          600: '#6d8196',
          700: '#4a5a6a',
          800: '#33404d',
          900: '#1f2328',
        },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', '"Red Hat Text"', '"Segoe UI"', 'sans-serif'],
        display: ['"Archivo Black"', '"Red Hat Display"', '"IBM Plex Sans"', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
