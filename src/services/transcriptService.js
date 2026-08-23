import discordTranscripts from 'discord-html-transcripts';
import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import { GuildConfig } from '../models/GuildConfig.js';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';

export const transcriptService = {
  async generateTranscript(channel) {
    try {
      const attachment = await discordTranscripts.createTranscript(channel, {
        limit: -1,
        returnType: 'buffer',
        filename: `transcript-${channel.name}.html`,
        saveImages: true,
        poweredBy: false,
        hydrate: true
      });

      return new AttachmentBuilder(attachment, { name: `transcript-${channel.name}.html` });
    } catch (error) {
      logger.error(`Failed to generate HTML transcript for channel ${channel.id}:`, error);
      return null;
    }
  },

  async handleTicketClosureTranscripts(ticket, channel, closedByUser, closeReason = 'No reason provided') {
    if (!config.features.transcripts.enabled) {
      return null;
    }

    const transcriptAttachment = await this.generateTranscript(channel);
    if (!transcriptAttachment) {
      return null;
    }

    const guild = channel.guild;
    const guildConfig = await GuildConfig.findOne({ guildId: guild.id }).lean();

    const durationMs = Date.now() - new Date(ticket.createdAt).getTime();
    const durationMinutes = Math.round(durationMs / (1000 * 60));
    const durationHours = (durationMinutes / 60).toFixed(1);

    const logEmbed = new EmbedBuilder()
      .setColor(config.bot.embedColor)
      .setTitle(`📋 Ticket Closed | #${String(ticket.ticketNumber).padStart(4, '0')}`)
      .addFields(
        { name: '👤 Creator', value: `<@${ticket.userId}> (${ticket.userId})`, inline: true },
        { name: '🔒 Closed By', value: `<@${closedByUser.id}> (${closedByUser.id})`, inline: true },
        { name: '📁 Category', value: ticket.categoryId, inline: true },
        { name: '⚡ Priority', value: ticket.priority || 'MEDIUM', inline: true },
        { name: '⏱️ Duration', value: `${durationHours} hrs (${durationMinutes} mins)`, inline: true },
        { name: '🙋 Claimed By', value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : 'Unclaimed', inline: true },
        { name: '📌 Subject', value: ticket.subject || 'No subject', inline: false },
        { name: '📝 Close Reason', value: closeReason, inline: false }
      )
      .setFooter({ text: `Ticket ID: ${ticket.channelId}` })
      .setTimestamp();

    // 1. Post to Log Channel if enabled
    if (config.features.transcripts.saveToLogChannel && guildConfig?.logChannelId) {
      try {
        const logChannel = await guild.channels.fetch(guildConfig.logChannelId).catch(() => null);
        if (logChannel && logChannel.isTextBased()) {
          await logChannel.send({
            embeds: [logEmbed],
            files: [transcriptAttachment]
          });
        }
      } catch (logError) {
        logger.error(`Failed to send transcript to log channel for guild ${guild.id}:`, logError);
      }
    }

    // 2. Direct Message to Ticket Creator if enabled
    if (config.features.transcripts.dmToUser) {
      try {
        const creator = await guild.client.users.fetch(ticket.userId).catch(() => null);
        if (creator) {
          const userDmEmbed = new EmbedBuilder()
            .setColor(config.bot.embedColor)
            .setTitle(`Receipt: Ticket #${String(ticket.ticketNumber).padStart(4, '0')} Closed`)
            .setDescription(
              `Your support ticket in **${guild.name}** has been closed.\n` +
              `An interactive HTML transcript of your ticket is attached below.`
            )
            .addFields(
              { name: 'Server', value: guild.name, inline: true },
              { name: 'Category', value: ticket.categoryId, inline: true },
              { name: 'Closed By', value: closedByUser.tag || closedByUser.id, inline: true },
              { name: 'Reason', value: closeReason, inline: false }
            )
            .setFooter({ text: 'Thank you for contacting support.' })
            .setTimestamp();

          await creator.send({
            embeds: [userDmEmbed],
            files: [transcriptAttachment]
          }).catch(() => {
            // User likely has DMs disabled, ignore silently
          });
        }
      } catch (dmError) {
        logger.debug(`Could not DM transcript to user ${ticket.userId}:`, dmError.message);
      }
    }

    return transcriptAttachment;
  }
};
