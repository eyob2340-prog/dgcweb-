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
      target: 'es2020',
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Heavy PDF libs — only loaded when user clicks PDF export
            if (id.includes('jspdf') || id.includes('html2canvas')) {
              return 'pdf-vendor';
            }
            // Chart libs — only loaded on analytics page
            if (id.includes('recharts') || id.includes('d3-')) {
              return 'chart-vendor';
            }
            // Admin dashboard — separate chunk
            if (id.includes('AdminDashboard') || id.includes('VisualAnalytics')) {
              return 'admin-chunk';
            }
            // Survey form — separate chunk
            if (id.includes('SurveyForm') || id.includes('SurveyList')) {
              return 'survey-chunk';
            }
            // Complaint modals — separate chunk
            if (id.includes('CitizenComplaint') || id.includes('TicketTracker')) {
              return 'complaint-chunk';
            }
            // React core — always needed
            if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
              return 'react-vendor';
            }
            // Motion/framer — separate
            if (id.includes('motion') || id.includes('framer')) {
              return 'motion-vendor';
            }
          },
        },
      },
      // Raise limit to suppress warnings for intentionally large vendor bundles
      chunkSizeWarningLimit: 600,
    },
  };
});
