import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// За GitHub Pages: смени base во "/stres-ogledalo/" (името на твоето repo).
// За Vercel/Netlify остави "/".
export default defineConfig({
  plugins: [react()],
  base: "/",
});
