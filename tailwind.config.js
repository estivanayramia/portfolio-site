/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.html",
    "./EN/**/*.html",
    "./es/**/*.html",
    "./ar/**/*.html",
    "./projects/**/*.html",
    "./hobbies/**/*.html",
    "./assets/js/**/*.js"
  ],
  theme: {
    extend: {
      colors: { 
        beige: '#e1d4c2', 
        chocolate: '#362017', 
        indigodeep: '#212842', 
        ink: '#0a0a0a' 
      },
      fontFamily: { 
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji', 'sans-serif'] 
      },
      // Add extra-small breakpoint for mobile
      screens: {
        'xs': '480px',
      }
    },
  },
  plugins: [],
}

