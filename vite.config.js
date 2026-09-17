const { defineConfig } = require('vite');
const react = require('@vitejs/plugin-react');

module.exports = defineConfig({
  // GitHub Pages publishes this project at /TechOra/, while local development
  // and the Express server both run at the domain root.
  base: process.env.GITHUB_ACTIONS ? '/TechOra/' : '/',
  root: 'frontend', plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      // Product photos uploaded by the admin are stored and served by Express.
      '/uploads': 'http://localhost:3000'
    }
  },
  build: { outDir: 'dist', emptyOutDir: true }
});
