import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const copyPwaAssetsPlugin = () => {
  return {
    name: 'copy-pwa-assets',
    writeBundle() {
      const files = ['manifest.json', 'icon.svg'];
      files.forEach(file => {
        const srcPath = path.resolve(__dirname, file);
        const destPath = path.resolve(__dirname, 'dist', file);
        if (fs.existsSync(srcPath)) {
          if (!fs.existsSync(path.dirname(destPath))) {
            fs.mkdirSync(path.dirname(destPath), { recursive: true });
          }
          fs.copyFileSync(srcPath, destPath);
          console.log(`Copied ${file} to dist/`);
        }
      });
    }
  };
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [
      react(),
      copyPwaAssetsPlugin()
    ],
    define: {
      // Shims process.env.API_KEY so the existing code works
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    },
    build: {
      outDir: 'dist',
    }
  };
});