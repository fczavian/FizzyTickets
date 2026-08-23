import {
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder
} from 'discord.js';
import { GuildConfig } from '../models/GuildConfig.js';
import { Ticket } from '../models/Ticket.js';
import { Blacklist } from '../models/Blacklist.js';
import { config } from '../config/config.js';
import { embeds, PRIORITY_CONFIG } from '../utils/embedBuilder.js';
import { transcriptService } from './transcriptService.js';
import { withLock } from '../utils/lock.js';
import { rateLimiter } from '../utils/rateLimiter.js';
import { logger } from '../utils/logger.js';

export const ticketService = {
  async createTicket({ guild, member, categoryId, subject, description, answers = [] }) {
    const lockKey = `create_ticket_${guild.id}_${member.id}`;

    return await withLock(lockKey, async () => {
      // 1. Blacklist check
      if (config.features.blacklist.enabled) {
        const isBlacklisted = await Blacklist.findOne({
          guildId: guild.id,
          userId: member.id
        }).lean();

        if (isBlacklisted) {
          throw new Error(`You are blacklisted from opening tickets. Reason: ${isBlacklisted.reason}`);
        }
      }

      // 2. Cooldown check (anti-spam protection)
      const cooldownSec = config.features.cooldowns?.defaultCooldownSeconds || 15;
      if (config.features.cooldowns?.enabled) {
        const { onCooldown, secondsLeft } = rateLimiter.checkTicketCooldown(guild.id, member.id, cooldownSec);
        if (onCooldown) {
          throw new Error(`You are creating tickets too fast. Please wait ${secondsLeft} second(s) before opening another ticket.`);
        }
      }

      // 3. Fetch or initialize GuildConfig
      let guildConfig = await GuildConfig.findOne({ guildId: guild.id });
      if (!guildConfig) {
        guildConfig = await GuildConfig.create({
          guildId: guild.id,
          ticketCounter: 0
        });
      }

      // 4. User Ticket Limit check
      if (config.features.ticketLimits.enabled) {
        const maxLimit = guildConfig.ticketLimit || config.features.ticketLimits.maxOpenTicketsPerUser || 3;
        const activeTicketsCount = await Ticket.countDocuments({
          guildId: guild.id,
          userId: member.id,
          status: { $in: ['OPEN', 'CLAIMED', 'REOPENED'] }
        });

        if (activeTicketsCount >= maxLimit) {
          throw new Error(`You have reached the maximum open ticket limit (${maxLimit}). Please close an existing ticket first.`);
        }
      }

      // 4. Find Category configuration
      const category = guildConfig.categories?.find((c) => c.id === categoryId) || {
        id: categoryId,
        label: 'Support',
        emoji: '🎫',
        namingFormat: 'ticket-{counter}',
        defaultPriority: config.features.priority.defaultPriority || 'MEDIUM',
        supportRoleIds: []
      };

      // 5. Increment counter atomically
      const updatedConfig = await GuildConfig.findOneAndUpdate(
        { guildId: guild.id },
        { $inc: { ticketCounter: 1 } },
        { new: true, upsert: true }
      );

      const ticketNumber = updatedConfig.ticketCounter;
      const formattedCounter = String(ticketNumber).padStart(4, '0');

      // 6. Build channel name
      const channelName = (category.namingFormat || 'ticket-{counter}')
        .replace('{counter}', formattedCounter)
        .replace('{username}', member.user.username.toLowerCase().replace(/[^a-z0-9]/g, ''))
        .replace('{category}', category.id);

      // 7. Prepare channel permission overwrites
      const permissionOverwrites = [
        {
          id: guild.id,
          deny: [PermissionFlagsBits.ViewChannel]
        },
        {
          id: member.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks
          ]
        },
        {
          id: guild.client.user.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageMessages,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.AttachFiles
          ]
        }
      ];

      // Staff roles permission determination
      const staffRoleIds = new Set();

      // Add admin roles
      if (Array.isArray(guildConfig.adminRoleIds)) {
        guildConfig.adminRoleIds.forEach((id) => staffRoleIds.add(id));
      }

      // Add category roles or global roles
      if (config.features.perCategoryRoles.enabled && Array.isArray(category.supportRoleIds) && category.supportRoleIds.length > 0) {
        category.supportRoleIds.forEach((id) => staffRoleIds.add(id));
      } else if (Array.isArray(guildConfig.supportRoleIds)) {
        guildConfig.supportRoleIds.forEach((id) => staffRoleIds.add(id));
      }

      for (const roleId of staffRoleIds) {
        permissionOverwrites.push({
          id: roleId,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
            PermissionFlagsBits.ManageMessages
          ]
        });
      }

      // 8. Create Discord text channel
      const channelOptions = {
        name: channelName,
        type: ChannelType.GuildText,
        topic: `Ticket #${formattedCounter} | Creator: ${member.user.tag} (${member.id}) | Category: ${category.label}`,
        permissionOverwrites
      };

      if (category.channelCategoryId) {
        const parentCategory = guild.channels.cache.get(category.channelCategoryId);
        if (parentCategory && parentCategory.type === ChannelType.GuildCategory) {
          channelOptions.parent = category.channelCategoryId;
        }
      }

      const channel = await guild.channels.create(channelOptions);

      // 9. Save Ticket document in MongoDB
      const initialPriority = category.defaultPriority || config.features.priority.defaultPriority || 'MEDIUM';
      const ticketDoc = await Ticket.create({
        guildId: guild.id,
        channelId: channel.id,
        ticketNumber,
        categoryId: category.id,
        userId: member.id,
        priority: initialPriority,
        subject: subject || 'No subject provided',
        description: description || 'No description provided',
        answers: answers || [],
        status: 'OPEN',
        lastActivityAt: new Date()
      });

      // 10. Send Welcome Embed with Action Buttons
      const welcomeEmbed = embeds.ticketWelcome(ticketDoc, category, member.user);
      const controlButtons = embeds.ticketControlButtons(ticketDoc);

      // Build staff mention list for initial alert (respecting mentionStaff toggle)
      const shouldMentionStaff = guildConfig.mentionStaff !== false;
      const staffPings = shouldMentionStaff
        ? Array.from(staffRoleIds).map((id) => `<@&${id}>`).join(' ')
        : '';
      const mentionContent = staffPings ? `<@${member.id}> ${staffPings}` : `<@${member.id}>`;

      const welcomeMessage = await channel.send({
        content: mentionContent,
        embeds: [welcomeEmbed],
        components: controlButtons
      });

      ticketDoc.welcomeMessageId = welcomeMessage.id;
      await ticketDoc.save();

      // Record creation for cooldown tracking
      rateLimiter.recordTicketCreation(guild.id, member.id);

      logger.info(`Created ticket #${formattedCounter} in channel #${channel.name} (${channel.id}) for ${member.user.tag}`);
      return { ticket: ticketDoc, channel };
    });
  },

  async claimTicket({ ticket, member, channel }) {
    if (!config.features.claiming.enabled) {
      throw new Error('Ticket claiming is currently disabled in system settings.');
    }

    const lockKey = `ticket_claim_${ticket.channelId}`;

    return await withLock(lockKey, async () => {
      // Atomic claim check
      const updatedTicket = await Ticket.findOneAndUpdate(
        { channelId: ticket.channelId, claimedBy: null },
        { claimedBy: member.id, status: 'CLAIMED', lastActivityAt: new Date() },
        { new: true }
      );

      if (!updatedTicket) {
        throw new Error('This ticket has already been claimed by another staff member.');
      }

      // Restrict visibility if configured
      if (config.features.claiming.restrictToClaimerOnly) {
        const guildConfig = await GuildConfig.findOne({ guildId: channel.guild.id }).lean();
        const supportRoles = guildConfig?.supportRoleIds || [];
        for (const roleId of supportRoles) {
          if (!member.roles.cache.has(roleId)) {
            await channel.permissionOverwrites.edit(roleId, {
              SendMessages: false
            }).catch(() => {});
          }
        }
      }

      // Update Channel Topic
      await channel.setTopic(
        `Ticket #${String(updatedTicket.ticketNumber).padStart(4, '0')} | Claimed by: ${member.user.tag}`
      ).catch(() => {});

      // Refresh Welcome Message Embed
      await this.refreshWelcomeMessage(updatedTicket, channel);

      return updatedTicket;
    });
  },

  async unclaimTicket({ ticket, member, channel }) {
    if (!config.features.claiming.enabled) {
      throw new Error('Ticket claiming is currently disabled in system settings.');
    }

    if (!config.features.claiming.allowStaffUnclaim) {
      throw new Error('Staff unclaiming is disabled.');
    }

    const lockKey = `ticket_claim_${ticket.channelId}`;

    return await withLock(lockKey, async () => {
      const updatedTicket = await Ticket.findOneAndUpdate(
        { channelId: ticket.channelId },
        { claimedBy: null, status: 'OPEN', lastActivityAt: new Date() },
        { new: true }
      );

      // Restore channel permissions if they were restricted
      if (config.features.claiming.restrictToClaimerOnly) {
        const guildConfig = await GuildConfig.findOne({ guildId: channel.guild.id }).lean();
        const supportRoles = guildConfig?.supportRoleIds || [];
        for (const roleId of supportRoles) {
          await channel.permissionOverwrites.edit(roleId, {
            SendMessages: true
          }).catch(() => {});
        }
      }

      // Update Channel Topic
      await channel.setTopic(
        `Ticket #${String(updatedTicket.ticketNumber).padStart(4, '0')} | Unclaimed`
      ).catch(() => {});

      // Refresh Welcome Message Embed
      await this.refreshWelcomeMessage(updatedTicket, channel);

      return updatedTicket;
    });
  },

  async setPriority({ ticket, priority, member, channel }) {
    if (!config.features.priority.enabled) {
      throw new Error('Priority management is disabled in system settings.');
    }

    const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
    if (!validPriorities.includes(priority)) {
      throw new Error('Invalid priority level.');
    }

    ticket.priority = priority;
    ticket.lastActivityAt = new Date();
    await ticket.save();

    await this.refreshWelcomeMessage(ticket, channel);

    const priorityInfo = PRIORITY_CONFIG[priority];
    const alertEmbed = embeds.primary(
      'Priority Updated',
      `Ticket priority changed to **${priorityInfo.emoji} ${priorityInfo.label}** by <@${member.id}>.`
    );
    await channel.send({ embeds: [alertEmbed] });

    return ticket;
  },

  async addUser({ ticket, targetUser, channel, addedBy }) {
    if (!config.features.memberManagement.enabled) {
      throw new Error('Member management is disabled.');
    }

    if (ticket.userId === targetUser.id || ticket.addedUsers.includes(targetUser.id)) {
      throw new Error('This user is already part of this ticket.');
    }

    await channel.permissionOverwrites.edit(targetUser.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true,
      EmbedLinks: true
    });

    ticket.addedUsers.push(targetUser.id);
    ticket.lastActivityAt = new Date();
    await ticket.save();

    const successEmbed = embeds.success(
      'User Added',
      `<@${targetUser.id}> was added to the ticket by <@${addedBy.id}>.`
    );
    await channel.send({ embeds: [successEmbed] });
  },

  async removeUser({ ticket, targetUser, channel, removedBy }) {
    if (!config.features.memberManagement.enabled) {
      throw new Error('Member management is disabled.');
    }

    if (ticket.userId === targetUser.id) {
      throw new Error('You cannot remove the ticket creator from their own ticket.');
    }

    await channel.permissionOverwrites.delete(targetUser.id).catch(() => {});

    ticket.addedUsers = ticket.addedUsers.filter((id) => id !== targetUser.id);
    ticket.lastActivityAt = new Date();
    await ticket.save();

    const successEmbed = embeds.warning(
      'User Removed',
      `<@${targetUser.id}> was removed from the ticket by <@${removedBy.id}>.`
    );
    await channel.send({ embeds: [successEmbed] });
  },

  async renameTicket({ ticket, newName, channel, renamedBy }) {
    const formattedName = newName.toLowerCase().replace(/[^a-z0-9-]/g, '-').substring(0, 32);
    await channel.setName(formattedName);

    ticket.lastActivityAt = new Date();
    await ticket.save();

    const embed = embeds.primary(
      'Ticket Renamed',
      `Channel renamed to **#${formattedName}** by <@${renamedBy.id}>.`
    );
    await channel.send({ embeds: [embed] });
  },

  async closeTicket({ ticket, channel, closedByUser, reason = 'Closed by user/staff' }) {
    const lockKey = `close_ticket_${ticket.channelId}`;

    return await withLock(lockKey, async () => {
      ticket.status = 'CLOSED';
      ticket.closedAt = new Date();
      ticket.closedBy = closedByUser.id;
      ticket.closeReason = reason;
      await ticket.save();

      // Revoke ticket creator write permissions
      await channel.permissionOverwrites.edit(ticket.userId, {
        SendMessages: false
      }).catch(() => {});

      for (const addedId of ticket.addedUsers) {
        await channel.permissionOverwrites.edit(addedId, {
          SendMessages: false
        }).catch(() => {});
      }

      // Generate HTML Transcript and dispatch to log channel and DM
      await transcriptService.handleTicketClosureTranscripts(ticket, channel, closedByUser, reason);

      // Post closed action box in channel
      const closedEmbed = new EmbedBuilder()
        .setColor('#ED4245')
        .setTitle('🔒 Ticket Closed')
        .setDescription(
          `This ticket was closed by <@${closedByUser.id}>.\n` +
          `**Reason:** ${reason}`
        )
        .setTimestamp();

      const closedButtons = embeds.closedControlButtons(ticket);

      await channel.send({
        embeds: [closedEmbed],
        components: closedButtons
      });

      logger.info(`Ticket #${ticket.ticketNumber} closed by ${closedByUser.tag}`);
      return ticket;
    });
  },

  async reopenTicket({ ticket, channel, reopenedByUser }) {
    if (!config.features.reopen.enabled) {
      throw new Error('Ticket reopening is disabled.');
    }

    if (ticket.status !== 'CLOSED') {
      throw new Error('Only closed tickets can be reopened.');
    }

    // Check reopen time window
    const reopenWindowMinutes = config.features.reopen.reopenWindowMinutes || 60;
    if (ticket.closedAt) {
      const elapsedMinutes = (Date.now() - new Date(ticket.closedAt).getTime()) / (1000 * 60);
      if (elapsedMinutes > reopenWindowMinutes) {
        throw new Error(`The reopen window of ${reopenWindowMinutes} minutes has passed.`);
      }
    }

    ticket.status = 'REOPENED';
    ticket.reopenedAt = new Date();
    ticket.reopenedBy = reopenedByUser.id;
    ticket.lastActivityAt = new Date();
    await ticket.save();

    // Restore member write permissions
    await channel.permissionOverwrites.edit(ticket.userId, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true,
      EmbedLinks: true
    }).catch(() => {});

    await this.refreshWelcomeMessage(ticket, channel);

    const reopenEmbed = embeds.success(
      'Ticket Reopened',
      `This ticket was reopened by <@${reopenedByUser.id}>.`
    );
    await channel.send({ embeds: [reopenEmbed] });

    logger.info(`Ticket #${ticket.ticketNumber} reopened by ${reopenedByUser.tag}`);
    return ticket;
  },

  async deleteTicket({ ticket, channel, deletedByUser }) {
    const lockKey = `delete_ticket_${ticket.channelId}`;

    return await withLock(lockKey, async () => {
      const deleteEmbed = embeds.warning(
        'Ticket Deleting',
        `This ticket will be deleted in 5 seconds by <@${deletedByUser.id}>.`
      );
      await channel.send({ embeds: [deleteEmbed] }).catch(() => {});

      setTimeout(async () => {
        try {
          await channel.delete(`Ticket deleted by ${deletedByUser.tag}`);
          await Ticket.deleteOne({ channelId: ticket.channelId });
          logger.info(`Deleted ticket #${ticket.ticketNumber} (${ticket.channelId})`);
        } catch (error) {
          logger.error(`Failed to delete channel ${ticket.channelId}:`, error);
        }
      }, 5000);
    });
  },

  async refreshWelcomeMessage(ticket, channel) {
    if (!ticket.welcomeMessageId) return;

    try {
      const welcomeMsg = await channel.messages.fetch(ticket.welcomeMessageId).catch(() => null);
      if (!welcomeMsg) return;

      const guildConfig = await GuildConfig.findOne({ guildId: channel.guild.id }).lean();
      const category = guildConfig?.categories?.find((c) => c.id === ticket.categoryId);
      const creatorUser = await channel.client.users.fetch(ticket.userId).catch(() => null);

      const updatedEmbed = embeds.ticketWelcome(ticket, category, creatorUser);
      const updatedButtons = embeds.ticketControlButtons(ticket);

      await welcomeMsg.edit({
        embeds: [updatedEmbed],
        components: updatedButtons
      });
    } catch (error) {
      logger.debug(`Could not update welcome message for ticket ${ticket.channelId}:`, error.message);
    }
  }
};
