/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        flock: "#f43f5e",     // Rose-500
        speed: "#f59e0b",     // Amber-500
        red_light: "#ef4444", // Red-500
        anpr: "#8b5cf6"       // Purple-500
      }
    },
  },
  plugins: [],
}
