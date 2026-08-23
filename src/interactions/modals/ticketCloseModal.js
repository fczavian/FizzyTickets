import { MessageFlags } from 'discord.js';
import { Ticket } from '../../models/Ticket.js';
import { ticketService } from '../../services/ticketService.js';
import { embeds } from '../../utils/embedBuilder.js';

export async function handleTicketCloseModal(interaction) {
  const channelId = interaction.customId.replace('ticket_close_modal_', '');
  const reason = interaction.fields.getTextInputValue('close_reason') || 'No reason provided';

  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  const ticket = await Ticket.findOne({ channelId });
  if (!ticket) {
    return interaction.editReply({
      embeds: [embeds.error('Not Found', 'No ticket data found for this channel.')]
    });
  }

  if (ticket.status === 'CLOSED') {
    return interaction.editReply({
      embeds: [embeds.warning('Already Closed', 'This ticket is already closed.')]
    });
  }

  try {
    await ticketService.closeTicket({
      ticket,
      channel: interaction.channel,
      closedByUser: interaction.user,
      reason
    });

    await interaction.editReply({
      embeds: [embeds.success('Ticket Closed', 'The ticket has been closed successfully.')]
    });
  } catch (error) {
    await interaction.editReply({
      embeds: [embeds.error('Failed to Close Ticket', error.message)]
    });
  }
}
