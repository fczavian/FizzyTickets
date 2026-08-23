import { Client, GatewayIntentBits, Partials, Collection } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { config } from './config/config.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { stopInactivityMonitor } from './services/inactivityService.js';
import { logger } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ],
  partials: [
    Partials.Channel,
    Partials.Message,
    Partials.User,
    Partials.GuildMember
  ]
});

client.commands = new Collection();

async function loadCommands(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await loadCommands(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const fileUrl = pathToFileURL(fullPath).href;
      const commandModule = await import(fileUrl);
      const command = commandModule.default || commandModule;
      if (command && command.data && command.execute) {
        client.commands.set(command.data.name, command);
        logger.debug(`Loaded command: /${command.data.name}`);
      }
    }
  }
}

async function loadEvents(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await loadEvents(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const fileUrl = pathToFileURL(fullPath).href;
      const eventModule = await import(fileUrl);
      const event = eventModule.default || eventModule;
      if (event && event.name && event.execute) {
        if (event.once) {
          client.once(event.name, (...args) => event.execute(...args));
        } else {
          client.on(event.name, (...args) => event.execute(...args));
        }
        logger.debug(`Registered event: ${event.name}`);
      }
    }
  }
}

async function bootstrap() {
  logger.info('=============================================');
  logger.info('  FizzyTickets | Powered by FizzyStudio');
  logger.info('=============================================');
  logger.info('Starting FizzyTickets bot...');

  // Connect to Database
  await connectDatabase();

  // Load Commands
  const commandsPath = path.join(__dirname, 'commands');
  if (fs.existsSync(commandsPath)) {
    await loadCommands(commandsPath);
    logger.info(`Loaded ${client.commands.size} application commands.`);
  }

  // Load Events
  const eventsPath = path.join(__dirname, 'events');
  if (fs.existsSync(eventsPath)) {
    await loadEvents(eventsPath);
  }

  // Validate Token
  if (!config.bot.token || config.bot.token === 'YOUR_DISCORD_BOT_TOKEN') {
    logger.warn('No valid DISCORD_TOKEN found in config.yml. Please add your token to start the bot.');
    return;
  }

  // Log into Discord
  try {
    await client.login(config.bot.token);
  } catch (error) {
    logger.error('Failed to log in to Discord:', error);
  }
}

// Graceful Shutdown Handlers
async function shutdown(signal) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  stopInactivityMonitor();
  await disconnectDatabase();
  client.destroy();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Promise Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

// Boot the application
bootstrap();
