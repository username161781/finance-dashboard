import { defineConfig } from 'vite';

export default defineConfig({
  base: '/finance-dashboard/', // ТОЧНО как называется ваш репозиторий!
  server: {
    port: 3000,
    open: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});