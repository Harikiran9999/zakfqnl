/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./*.{tsx,html}", "./contents/*.{tsx,html}"],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        offwhite: "#F9FAFB",
        accent: "#4F46E5",
        success: "#10B981",
      },
      borderRadius: { xl2: "18px" },
    },
  },
  plugins: [],
};
