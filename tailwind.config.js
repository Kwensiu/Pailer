/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx,css}'],
  safelist: [
    // Custom background color classes - 保留确保不被清除
    'bg-base-50',
    'bg-base-100',
    'bg-base-150',
    'bg-base-175',
    'bg-base-200',
    'bg-base-250',
    'bg-base-300',
    'bg-base-350',
    'bg-base-400',
    'bg-base-content-bg',
    'bg-base-card',
    'bg-base-list',
    // Custom border color classes
    'border-base-175',
    'border-base-200',
    'border-base-300',
    // Text color classes
    'text-base-content',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
