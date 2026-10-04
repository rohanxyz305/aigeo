import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In development the Spring Boot API runs on 8080; production uses VITE_API_URL instead.
    proxy: { '/api': 'http://localhost:8080' },
  },
});
