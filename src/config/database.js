import mongoose from 'mongoose';
import { config } from './config.js';
import { logger } from '../utils/logger.js';

export async function connectDatabase() {
  try {
    mongoose.set('strictQuery', true);

    mongoose.connection.on('connected', () => {
      logger.success('Connected to MongoDB database.');
    });

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Reconnecting...');
    });

    await mongoose.connect(config.bot.mongoUri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000
    });
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

export async function disconnectDatabase() {
  try {
    await mongoose.disconnect();
    logger.info('Disconnected from MongoDB.');
  } catch (error) {
    logger.error('Error while disconnecting MongoDB:', error);
  }
}
