import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags
} from 'discord.js';
import { Ticket } from '../../models/Ticket.js';
import { ticketService } from '../../services/ticketService.js';
import { embeds } from '../../utils/embedBuilder.js';
import { canManageTicket } from '../../utils/permissionChecker.js';

export async function handleTicketCloseButton(interaction) {
  const channelId = interaction.customId.replace('ticket_close_', '');
  const ticket = await Ticket.findOne({ channelId });

  if (!ticket) {
    return interaction.reply({
      embeds: [embeds.error('Not Found', 'No ticket data found for this channel.')],
      flags: [MessageFlags.Ephemeral]
    });
  }

  if (ticket.status === 'CLOSED') {
    return interaction.reply({
      embeds: [embeds.warning('Already Closed', 'This ticket is already closed.')],
      flags: [MessageFlags.Ephemeral]
    });
  }

  // Check if member is creator or staff
  const isCreator = ticket.userId === interaction.user.id;
  const isStaff = await canManageTicket(interaction.member, ticket);

  if (!isCreator && !isStaff) {
    return interaction.reply({
      embeds: [embeds.error('Permission Denied', 'You do not have permission to close this ticket.')],
      flags: [MessageFlags.Ephemeral]
    });
  }

  // Show confirmation row
  const confirmRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_close_confirm_${channelId}`)
      .setLabel('Confirm Close')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`ticket_close_reason_${channelId}`)
      .setLabel('Close with Reason')
      .setEmoji('📝')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`ticket_close_cancel_${channelId}`)
      .setLabel('Cancel')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Secondary)
  );

  const confirmEmbed = embeds.warning(
    'Close Confirmation',
    'Are you sure you want to close this ticket? A transcript will be created automatically.'
  );

  await interaction.reply({
    embeds: [confirmEmbed],
    components: [confirmRow],
    flags: [MessageFlags.Ephemeral]
  });
}

export async function handleTicketCloseConfirm(interaction) {
  const channelId = interaction.customId.replace('ticket_close_confirm_', '');
  const ticket = await Ticket.findOne({ channelId });

  if (!ticket) {
    return interaction.reply({
      embeds: [embeds.error('Not Found', 'No ticket data found for this channel.')],
      flags: [MessageFlags.Ephemeral]
    });
  }

  if (ticket.status === 'CLOSED') {
    return interaction.reply({
      embeds: [embeds.warning('Already Closed', 'This ticket is already closed.')],
      flags: [MessageFlags.Ephemeral]
    });
  }

  await interaction.deferUpdate();

  try {
    await ticketService.closeTicket({
      ticket,
      channel: interaction.channel,
      closedByUser: interaction.user,
      reason: 'Closed by user confirmation'
    });
  } catch (error) {
    await interaction.followUp({
      embeds: [embeds.error('Failed to Close', error.message)],
      flags: [MessageFlags.Ephemeral]
    });
  }
}

export async function handleTicketCloseReasonPrompt(interaction) {
  const channelId = interaction.customId.replace('ticket_close_reason_', '');

  const modal = new ModalBuilder()
    .setCustomId(`ticket_close_modal_${channelId}`)
    .setTitle('Close Ticket Reason');

  const reasonInput = new TextInputBuilder()
    .setCustomId('close_reason')
    .setLabel('Reason for closing')
    .setPlaceholder('Enter why this ticket is being closed')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(500);

  modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));

  await interaction.showModal(modal);
}

export async function handleTicketCloseCancel(interaction) {
  const cancelEmbed = embeds.primary(
    'Action Cancelled',
    'Ticket closure has been cancelled.'
  );

  await interaction.update({
    embeds: [cancelEmbed],
    components: []
  });
}
