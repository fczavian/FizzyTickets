import { MessageFlags } from 'discord.js';
import { Ticket } from '../../models/Ticket.js';
import { ticketService } from '../../services/ticketService.js';
import { embeds } from '../../utils/embedBuilder.js';
import { canManageTicket } from '../../utils/permissionChecker.js';

export async function handleTicketDeleteButton(interaction) {
  const channelId = interaction.customId.replace('ticket_delete_', '');
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
      embeds: [embeds.error('Permission Denied', 'Only support staff can delete tickets.')],
      flags: [MessageFlags.Ephemeral]
    });
  }

  await interaction.reply({
    embeds: [embeds.warning('Deleting Ticket', 'Scheduling ticket channel deletion in 5 seconds...')],
    flags: [MessageFlags.Ephemeral]
  });

  try {
    await ticketService.deleteTicket({
      ticket,
      channel: interaction.channel,
      deletedByUser: interaction.user
    });
  } catch (error) {
    await interaction.followUp({
      embeds: [embeds.error('Failed to Delete Ticket', error.message)],
      flags: [MessageFlags.Ephemeral]
    });
  }
}
