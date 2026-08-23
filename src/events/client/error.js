import { Events } from 'discord.js';
import { logger } from '../../utils/logger.js';

export default {
  name: Events.Error,
  execute(error) {
    logger.error('Discord client encountered an error:', error);
  }
};
