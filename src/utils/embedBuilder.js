import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} from 'discord.js';
import { config } from '../config/config.js';

export const PRIORITY_CONFIG = {
  LOW: {
    label: 'Low',
    emoji: '🟢',
    color: '#57F287'
  },
  MEDIUM: {
    label: 'Medium',
    emoji: '🟡',
    color: '#FEE75C'
  },
  HIGH: {
    label: 'High',
    emoji: '🟠',
    color: '#E67E22'
  },
  URGENT: {
    label: 'Urgent',
    emoji: '🔴',
    color: '#ED4245'
  }
};

export const embeds = {
  primary(title, description) {
    const embed = new EmbedBuilder()
      .setColor(config.bot.embedColor)
      .setFooter({ text: 'Powered by FizzyStudio' })
      .setTimestamp();

    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);
    return embed;
  },

  success(title, description) {
    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setFooter({ text: 'Powered by FizzyStudio' })
      .setTimestamp();

    if (title) embed.setTitle(`✅ ${title}`);
    if (description) embed.setDescription(description);
    return embed;
  },

  error(title, description) {
    const embed = new EmbedBuilder()
      .setColor('#ED4245')
      .setFooter({ text: 'Powered by FizzyStudio' })
      .setTimestamp();

    if (title) embed.setTitle(`❌ ${title}`);
    if (description) embed.setDescription(description);
    return embed;
  },

  warning(title, description) {
    const embed = new EmbedBuilder()
      .setColor('#FEE75C')
      .setFooter({ text: 'Powered by FizzyStudio' })
      .setTimestamp();

    if (title) embed.setTitle(`⚠️ ${title}`);
    if (description) embed.setDescription(description);
    return embed;
  },

  ticketWelcome(ticket, category, creatorUser) {
    const priority = PRIORITY_CONFIG[ticket.priority] || PRIORITY_CONFIG.MEDIUM;
    const categoryName = category ? `${category.emoji} ${category.label}` : ticket.categoryId;

    const embed = new EmbedBuilder()
      .setColor(config.bot.embedColor)
      .setTitle(`Ticket #${String(ticket.ticketNumber).padStart(4, '0')} | ${category?.label || 'Support'}`)
      .setDescription(
        `Welcome <@${ticket.userId}>. Support staff will assist you shortly.\n` +
        `Please provide all relevant details, error logs, or screenshots to help speed up support.`
      )
      .addFields(
        { name: '👤 Creator', value: `<@${ticket.userId}>`, inline: true },
        { name: '📁 Category', value: categoryName, inline: true },
        { name: '⚡ Priority', value: `${priority.emoji} ${priority.label}`, inline: true },
        { name: '📌 Subject', value: ticket.subject || 'No subject provided', inline: false }
      )
      .setFooter({
        text: `Created by ${creatorUser?.tag || ticket.userId}`,
        iconURL: creatorUser?.displayAvatarURL?.() || null
      })
      .setTimestamp();

    if (ticket.answers && ticket.answers.length > 0) {
      for (const item of ticket.answers) {
        if (item.answer && item.answer.trim()) {
          embed.addFields({
            name: `❓ ${item.question}`.substring(0, 256),
            value: item.answer.length > 1020 ? item.answer.substring(0, 1017) + '...' : item.answer,
            inline: false
          });
        }
      }
    } else if (ticket.description && ticket.description !== 'No description provided') {
      embed.addFields({
        name: '📝 Details',
        value: ticket.description.length > 1000
          ? ticket.description.substring(0, 997) + '...'
          : ticket.description,
        inline: false
      });
    }

    if (ticket.claimedBy) {
      embed.addFields({
        name: '🙋 Claimed By',
        value: `<@${ticket.claimedBy}>`,
        inline: true
      });
    }

    return embed;
  },

  ticketControlButtons(ticket) {
    const rows = [];
    const mainRow = new ActionRowBuilder();

    // 1. Close Button (always available)
    mainRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_close_${ticket.channelId}`)
        .setLabel('Close')
        .setEmoji('🔒')
        .setStyle(ButtonStyle.Danger)
    );

    // 2. Claim / Unclaim Button (if claiming feature enabled)
    if (config.features.claiming.enabled) {
      if (ticket.claimedBy) {
        mainRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`ticket_unclaim_${ticket.channelId}`)
            .setLabel('Unclaim')
            .setEmoji('🔓')
            .setStyle(ButtonStyle.Secondary)
        );
      } else {
        mainRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`ticket_claim_${ticket.channelId}`)
            .setLabel('Claim')
            .setEmoji('🙋')
            .setStyle(ButtonStyle.Primary)
        );
      }
    }

    // 3. Priority Button (if priority feature enabled)
    if (config.features.priority.enabled) {
      mainRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_priority_btn_${ticket.channelId}`)
          .setLabel('Priority')
          .setEmoji('⚡')
          .setStyle(ButtonStyle.Secondary)
      );
    }

    // 4. Manage Members Button (if memberManagement feature enabled)
    if (config.features.memberManagement.enabled) {
      mainRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_members_btn_${ticket.channelId}`)
          .setLabel('Members')
          .setEmoji('👥')
          .setStyle(ButtonStyle.Secondary)
      );
    }

    rows.push(mainRow);

    // Second row: Transcript & Quick Tools
    const secondaryRow = new ActionRowBuilder();

    if (config.features.transcripts.enabled) {
      secondaryRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_transcript_btn_${ticket.channelId}`)
          .setLabel('Transcript')
          .setEmoji('📄')
          .setStyle(ButtonStyle.Secondary)
      );
    }

    if (secondaryRow.components.length > 0) {
      rows.push(secondaryRow);
    }

    return rows;
  },

  closedControlButtons(ticket) {
    const row = new ActionRowBuilder();

    if (config.features.reopen.enabled) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_reopen_${ticket.channelId}`)
          .setLabel('Reopen')
          .setEmoji('🔄')
          .setStyle(ButtonStyle.Success)
      );
    }

    if (config.features.transcripts.enabled) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`ticket_transcript_btn_${ticket.channelId}`)
          .setLabel('Transcript')
          .setEmoji('📄')
          .setStyle(ButtonStyle.Secondary)
      );
    }

    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_delete_${ticket.channelId}`)
        .setLabel('Delete')
        .setEmoji('🗑️')
        .setStyle(ButtonStyle.Danger)
    );

    return [row];
  }
};
