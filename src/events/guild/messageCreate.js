import { Events } from 'discord.js';
import { Ticket } from '../../models/Ticket.js';

export default {
  name: Events.MessageCreate,
  async execute(message) {
    if (message.author.bot || !message.guild) return;

    // Reset inactivity timer for active tickets
    await Ticket.updateOne(
      {
        channelId: message.channel.id,
        status: { $in: ['OPEN', 'CLAIMED', 'REOPENED'] }
      },
      {
        $set: {
          lastActivityAt: new Date(),
          inactivityWarningSent: false
        }
      }
    ).catch(() => {});
  }
};
