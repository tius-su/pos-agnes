import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Deteksi apakah sedang di GitHub Actions atau local
const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';
// Repo name untuk GitHub Pages base path (ubah sesuai nama repo kamu)
const repoName = 'pos-agnes'; // sesuai https://tius-su.github.io/pos-agnes/

export default defineConfig({
  plugins: [react()],
  // Base path: '/' di local, '/pos-agnes/' di GitHub Pages
  base: isGitHubPages ? `/${repoName}/` : '/',
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase')) {
            return 'firebase';
          }
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
            return 'recharts';
          }
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react-vendor';
          }
        }
      }
    }
  }
});
