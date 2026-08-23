import { MessageFlags } from 'discord.js';
import { Ticket } from '../../models/Ticket.js';
import { ticketService } from '../../services/ticketService.js';
import { embeds } from '../../utils/embedBuilder.js';
import { canManageTicket } from '../../utils/permissionChecker.js';

export async function handleTicketReopenButton(interaction) {
  const channelId = interaction.customId.replace('ticket_reopen_', '');
  const ticket = await Ticket.findOne({ channelId });

  if (!ticket) {
    return interaction.reply({
      embeds: [embeds.error('Not Found', 'No ticket data found for this channel.')],
      flags: [MessageFlags.Ephemeral]
    });
  }

  const isStaff = await canManageTicket(interaction.member, ticket);
  const isCreator = ticket.userId === interaction.user.id;

  if (!isStaff && !isCreator) {
    return interaction.reply({
      embeds: [embeds.error('Permission Denied', 'You do not have permission to reopen this ticket.')],
      flags: [MessageFlags.Ephemeral]
    });
  }

  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  try {
    await ticketService.reopenTicket({
      ticket,
      channel: interaction.channel,
      reopenedByUser: interaction.user
    });

    await interaction.editReply({
      embeds: [embeds.success('Reopened', 'The ticket has been reopened.')]
    });
  } catch (error) {
    await interaction.editReply({
      embeds: [embeds.error('Failed to Reopen Ticket', error.message)]
    });
  }
}
