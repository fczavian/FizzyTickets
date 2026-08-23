import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { logger } from '../utils/logger.js';

const configPath = path.resolve(process.cwd(), 'config.yml');

let rawConfig = {};

try {
  if (fs.existsSync(configPath)) {
    const fileContents = fs.readFileSync(configPath, 'utf8');
    rawConfig = YAML.parse(fileContents) || {};
  } else {
    logger.warn('config.yml not found. Falling back to environment variables.');
  }
} catch (error) {
  logger.error('Failed to parse config.yml:', error);
  process.exit(1);
}

export const config = {
  bot: {
    token: process.env.DISCORD_TOKEN || rawConfig.bot?.token || '',
    clientId: process.env.CLIENT_ID || rawConfig.bot?.clientId || '',
    mongoUri: process.env.MONGODB_URI || rawConfig.bot?.mongoUri || 'mongodb://127.0.0.1:27017/fizzytickets',
    embedColor: rawConfig.bot?.embedColor || '#5865F2',
    devGuildId: process.env.DEV_GUILD_ID || rawConfig.bot?.devGuildId || ''
  },
  features: {
    claiming: {
      enabled: rawConfig.features?.claiming?.enabled ?? true,
      allowStaffUnclaim: rawConfig.features?.claiming?.allowStaffUnclaim ?? true,
      restrictToClaimerOnly: rawConfig.features?.claiming?.restrictToClaimerOnly ?? false
    },
    perCategoryRoles: {
      enabled: rawConfig.features?.perCategoryRoles?.enabled ?? true
    },
    priority: {
      enabled: rawConfig.features?.priority?.enabled ?? true,
      defaultPriority: rawConfig.features?.priority?.defaultPriority || 'MEDIUM',
      allowStaffChange: rawConfig.features?.priority?.allowStaffChange ?? true
    },
    modals: {
      enabled: rawConfig.features?.modals?.enabled ?? true,
      requireSubject: rawConfig.features?.modals?.requireSubject ?? true,
      requireDescription: rawConfig.features?.modals?.requireDescription ?? true
    },
    transcripts: {
      enabled: rawConfig.features?.transcripts?.enabled ?? true,
      saveToLogChannel: rawConfig.features?.transcripts?.saveToLogChannel ?? true,
      dmToUser: rawConfig.features?.transcripts?.dmToUser ?? true,
      format: rawConfig.features?.transcripts?.format || 'html'
    },
    inactivity: {
      enabled: rawConfig.features?.inactivity?.enabled ?? true,
      checkIntervalMinutes: rawConfig.features?.inactivity?.checkIntervalMinutes || 10,
      warningHours: rawConfig.features?.inactivity?.warningHours || 24,
      autoCloseHours: rawConfig.features?.inactivity?.autoCloseHours || 48
    },
    memberManagement: {
      enabled: rawConfig.features?.memberManagement?.enabled ?? true,
      allowStaffOnly: rawConfig.features?.memberManagement?.allowStaffOnly ?? true
    },
    reopen: {
      enabled: rawConfig.features?.reopen?.enabled ?? true,
      reopenWindowMinutes: rawConfig.features?.reopen?.reopenWindowMinutes || 60
    },
    ticketLimits: {
      enabled: rawConfig.features?.ticketLimits?.enabled ?? true,
      maxOpenTicketsPerUser: rawConfig.features?.ticketLimits?.maxOpenTicketsPerUser || 3
    },
    blacklist: {
      enabled: rawConfig.features?.blacklist?.enabled ?? true
    },
    cooldowns: {
      enabled: rawConfig.features?.cooldowns?.enabled ?? true,
      defaultCooldownSeconds: rawConfig.features?.cooldowns?.defaultCooldownSeconds || 30
    }
  },

  isFeatureEnabled(featureName) {
    if (!featureName) return false;
    const parts = featureName.split('.');
    let current = this.features;
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return false;
      }
    }
    if (typeof current === 'boolean') return current;
    if (current && typeof current === 'object' && 'enabled' in current) {
      return Boolean(current.enabled);
    }
    return Boolean(current);
  }
};
