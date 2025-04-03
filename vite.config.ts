import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    outDir: 'dist/tools/task-smasher',
    rollupOptions: {
      output: {
        manualChunks: {
          'lucide-react': ['lucide-react']
        }
      }
    }
  }
});
