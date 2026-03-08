/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      animation: {
        'drag-drop': 'dragDrop 0.3s ease-out',
        'fade-out': 'fadeOut 0.3s ease-out forwards',
        'drop-in': 'dropIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      keyframes: {
        dragDrop: {
          '0%': { transform: 'scale(1.02)', boxShadow: '0 0 0 rgba(0, 0, 0, 0)' },
          '100%': { transform: 'scale(0.98)', boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)' },
        },
        fadeOut: {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(20px)' },
        },
        dropIn: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
