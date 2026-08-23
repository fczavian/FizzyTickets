import { REST, Routes, ActivityType, Events } from 'discord.js';
import { config } from '../../config/config.js';
import { startInactivityMonitor } from '../../services/inactivityService.js';
import { logger } from '../../utils/logger.js';

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    logger.success(`Logged in as ${client.user.tag} (${client.user.id})`);

    // Set Bot Presence
    client.user.setPresence({
      activities: [
        {
          name: 'Support Tickets | /help',
          type: ActivityType.Watching
        }
      ],
      status: 'online'
    });

    // Deploy Slash Commands
    try {
      const rest = new REST({ version: '10' }).setToken(config.bot.token);
      const commandData = Array.from(client.commands.values()).map((cmd) => cmd.data.toJSON());

      if (config.bot.devGuildId) {
        logger.info(`Registering ${commandData.length} slash commands to dev guild: ${config.bot.devGuildId}...`);
        await rest.put(
          Routes.applicationGuildCommands(config.bot.clientId || client.user.id, config.bot.devGuildId),
          { body: commandData }
        );
        logger.success(`Registered slash commands to dev guild ${config.bot.devGuildId}.`);
      } else {
        logger.info(`Registering ${commandData.length} global slash commands...`);
        await rest.put(
          Routes.applicationCommands(config.bot.clientId || client.user.id),
          { body: commandData }
        );
        logger.success('Registered global slash commands.');
      }
    } catch (error) {
      logger.error('Failed to register application slash commands:', error);
    }

    // Start Inactivity Monitor Cron
    startInactivityMonitor(client);
  }
};
