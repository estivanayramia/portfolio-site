/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./*.html", "./es/*.html", "./ar/*.html", "./assets/js/*.js"],
  theme: {
    extend: {
      colors: { 
        beige: '#e1d4c2', 
        chocolate: '#362017', 
        indigodeep: '#212842', 
        ink: '#0a0a0a' 
      },
      fontFamily: { 
        sans: ['Inter', 'Helvetica', 'Arial', 'sans-serif'] 
      },
      // Add extra-small breakpoint for mobile
      screens: {
        'xs': '480px',
      }
    },
  },
  plugins: [],
}

