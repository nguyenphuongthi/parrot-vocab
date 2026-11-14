import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Khi dev: chạy các Vercel Function trong api/ ngay trên dev server (production do Vercel chạy).
function vercelApi() {
  return {
    name: 'vercel-api-dev',
    configureServer(server) {
      server.middlewares.use('/api/lookup', async (req, res) => {
        const { GET } = await server.ssrLoadModule('/api/lookup.js');
        const response = await GET(new Request(new URL(req.originalUrl, 'http://localhost')));
        res.statusCode = response.status;
        response.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(await response.text());
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), vercelApi()],
  build: { target: 'es2022' },
});
