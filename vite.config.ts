import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      minify: 'esbuild' as const,
      target: 'es2015',
      cssCodeSplit: true,
      // Chunk splitting to enable lazy loading & smaller initial bundles
      rollupOptions: {
        output: {
          manualChunks: {
            // React core — always needed
            'react-vendor': ['react', 'react-dom'],
            // Motion library — lazy-loaded chunks benefit
            'motion-vendor': ['motion/react'],
            // Recharts — heavy, only used in AdminDashboard
            'recharts-vendor': ['recharts'],
            // PDF / QR tools — only used on demand
            'export-vendor': ['jspdf', 'html2canvas', 'qrcode'],
            // Lucide icons — tree-shaken but still benefits from isolation
            'icons-vendor': ['lucide-react'],
          },
        },
      },
      // Warn when a chunk exceeds 500kb
      chunkSizeWarningLimit: 500,
    },
  };
});
