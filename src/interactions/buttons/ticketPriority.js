import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  MessageFlags
} from 'discord.js';
import { Ticket } from '../../models/Ticket.js';
import { ticketService } from '../../services/ticketService.js';
import { embeds, PRIORITY_CONFIG } from '../../utils/embedBuilder.js';
import { canManageTicket } from '../../utils/permissionChecker.js';

export async function handleTicketPriorityButton(interaction) {
  const channelId = interaction.customId.replace('ticket_priority_btn_', '');
  const ticket = await Ticket.findOne({ channelId });

  if (!ticket) {
    return interaction.reply({
      embeds: [embeds.error('Not Found', 'No ticket data found for this channel.')],
      flags: [MessageFlags.Ephemeral]
    });
  }

  const isStaff = await canManageTicket(interaction.member, ticket);
  if (!isStaff) {
    return interaction.reply({
      embeds: [embeds.error('Permission Denied', 'Only support staff can change ticket priority.')],
      flags: [MessageFlags.Ephemeral]
    });
  }

  const options = Object.entries(PRIORITY_CONFIG).map(([key, data]) => {
    return new StringSelectMenuOptionBuilder()
      .setLabel(data.label)
      .setValue(key)
      .setEmoji(data.emoji)
      .setDefault(ticket.priority === key);
  });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`ticket_set_priority_${channelId}`)
    .setPlaceholder('Select priority level...')
    .addOptions(options);

  const row = new ActionRowBuilder().addComponents(selectMenu);

  const promptEmbed = embeds.primary(
    'Update Priority',
    `Current Priority: **${PRIORITY_CONFIG[ticket.priority]?.emoji || '🟡'} ${PRIORITY_CONFIG[ticket.priority]?.label || 'Medium'}**\n` +
    `Choose a new priority level from the dropdown below.`
  );

  await interaction.reply({
    embeds: [promptEmbed],
    components: [row],
    flags: [MessageFlags.Ephemeral]
  });
}

export async function handleTicketSetPriority(interaction) {
  const channelId = interaction.customId.replace('ticket_set_priority_', '');
  const selectedPriority = interaction.values[0];

  const ticket = await Ticket.findOne({ channelId });
  if (!ticket) {
    return interaction.reply({
      embeds: [embeds.error('Not Found', 'No ticket data found for this channel.')],
      flags: [MessageFlags.Ephemeral]
    });
  }

  const isStaff = await canManageTicket(interaction.member, ticket);
  if (!isStaff) {
    return interaction.reply({
      embeds: [embeds.error('Permission Denied', 'Only support staff can change ticket priority.')],
      flags: [MessageFlags.Ephemeral]
    });
  }

  await interaction.deferUpdate();

  try {
    await ticketService.setPriority({
      ticket,
      priority: selectedPriority,
      member: interaction.member,
      channel: interaction.channel
    });

    const successEmbed = embeds.success(
      'Priority Changed',
      `Priority updated to **${PRIORITY_CONFIG[selectedPriority]?.emoji} ${PRIORITY_CONFIG[selectedPriority]?.label}**.`
    );

    await interaction.editReply({
      embeds: [successEmbed],
      components: []
    });
  } catch (error) {
    await interaction.editReply({
      embeds: [embeds.error('Failed to Set Priority', error.message)],
      components: []
    });
  }
}
