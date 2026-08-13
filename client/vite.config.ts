import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/health': 'http://localhost:3001',
      '/events': 'http://localhost:3001',
      '/publish': 'http://localhost:3001',
      '/entities': 'http://localhost:3001',
    },
  },
});
