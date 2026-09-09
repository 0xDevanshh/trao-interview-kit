import mongoose from 'mongoose';

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('[db] MONGODB_URI is not set');
    process.exit(1);
  }

  mongoose.connection.on('connected', () => {
    console.log('[db] connected');
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[db] disconnected');
  });

  mongoose.connection.on('error', (err) => {
    console.error('[db] connection error:', err);
  });

  try {
    await mongoose.connect(uri);
  } catch (err) {
    console.error('[db] initial connection failed:', err);
    process.exit(1);
  }
}
