import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '127.0.0.1', // IPv4 only — избягва [::1]-only binding на Windows
    port: 5173,
    strictPort: true,  // fail ако 5173 е зает, вместо да скача на 5174
    // open: true,    // опционално: отваря браузъра автоматично
  },
});
