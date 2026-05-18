import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// If you are deploying to GitHub Pages at https://<user>.github.io/<repo-name>/
// set base to "/<repo-name>/". For Vercel or custom domain root, leave as "/".
// You can override at build time with: VITE_BASE_PATH=/my-repo/ npm run build

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || "/al-naba-tracker/",
});
