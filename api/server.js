import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';

const app = Fastify({ logger: true });

await app.register(helmet);
await app.register(cors, { origin: true, credentials: true });

// Проверка живости API
app.get('/health', async () => ({ ok: true }));

const PORT = Number(process.env.PORT || 4000);
const HOST = '127.0.0.1';

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`API listening on http://${HOST}:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
