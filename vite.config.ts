import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// For Vercel deployment, use this simple config:
export default defineConfig({
  plugins: [react()],
  // Build settings for production
  build: {
    outDir: 'dist',          // Vercel expects 'dist' folder
    sourcemap: false,        // Disable sourcemaps for smaller build
    rollupOptions: {
      output: {
        manualChunks: undefined, // Prevent chunking issues
      }
    }
  },
  // Server settings for development
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  // IMPORTANT: Use relative paths for Vercel
  base: './',
  // Environment variables (simpler approach)
  define: {
    'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || '')
  }
});
