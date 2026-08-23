import { Events } from 'discord.js';
import { Ticket } from '../../models/Ticket.js';
import { logger } from '../../utils/logger.js';

export default {
  name: Events.ChannelDelete,
  async execute(channel) {
    if (!channel.guild) return;

    try {
      const ticket = await Ticket.findOne({ channelId: channel.id });
      if (ticket && ticket.status !== 'CLOSED') {
        ticket.status = 'CLOSED';
        ticket.closedAt = new Date();
        ticket.closeReason = 'Discord channel was deleted manually';
        await ticket.save();

        logger.info(`Updated ticket #${ticket.ticketNumber} to CLOSED after channel deletion.`);
      }
    } catch (error) {
      logger.error(`Error handling channelDelete for channel ${channel.id}:`, error);
    }
  }
};
