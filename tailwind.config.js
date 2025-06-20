/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#BB5F5A',
        secondary: "#6B7280",
        success: "#10B981",
        warning: "#F59E0B",
        error: "#EF4444",
        background: {
          primary: 'var(--bg-primary)',
          secondary: 'var(--bg-secondary)',
          container: 'var(--bg-container)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
        },
        border: 'var(--border-color)',
        task: {
          todo: {
            bg: 'var(--task-todo-bg)',
            border: 'var(--task-todo-border)',
          },
          pomodoro: {
            bg: 'var(--task-pomodoro-bg)',
            border: 'var(--task-pomodoro-border)',
          },
          completed: {
            bg: 'var(--task-completed-bg)',
            border: 'var(--task-completed-border)',
          },
        },
        checkbox: {
          bg: 'var(--checkbox-bg)',
          border: 'var(--checkbox-border)',
        },
        progress: {
          bg: 'var(--progress-bg)',
        },
      },
      borderRadius: {
        'none': '0px',
        'sm': '4px',
        DEFAULT: '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '20px',
        '2xl': '24px',
        '3xl': '32px',
        'full': '9999px',
        'button': '8px'
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        pacifico: ['Pacifico', 'cursive'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
} 