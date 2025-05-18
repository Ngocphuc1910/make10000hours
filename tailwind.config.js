/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#BB5F5A",
        secondary: "#6B7280",
        success: "#10B981",
        warning: "#F59E0B",
        error: "#EF4444",
      },
      borderRadius: {
        'none': '0px',
        'sm': '4px',
        'DEFAULT': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '20px',
        '2xl': '24px',
        '3xl': '32px',
        'full': '9999px',
        'button': '8px',
      },
      fontFamily: {
        'sans': ['Inter', 'sans-serif'],
        'pacifico': ['Pacifico', 'cursive'],
      },
    },
  },
  plugins: [],
}; 