import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/products': {
        target: 'https://codevector-task-au48.onrender.com',
        changeOrigin: true,
      },
    },
  },
});
