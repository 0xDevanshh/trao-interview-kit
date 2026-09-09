import 'dotenv/config';
import { connectDB } from './config/db.js';
import app from './app.js';

const PORT = process.env.PORT ?? 4000;

async function start(): Promise<void> {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`[server] listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});
