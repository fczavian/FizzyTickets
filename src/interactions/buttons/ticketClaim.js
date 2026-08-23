import { MessageFlags } from 'discord.js';
import { Ticket } from '../../models/Ticket.js';
import { ticketService } from '../../services/ticketService.js';
import { embeds } from '../../utils/embedBuilder.js';
import { canManageTicket } from '../../utils/permissionChecker.js';

export async function handleTicketClaimButton(interaction) {
  const channelId = interaction.customId.replace('ticket_claim_', '');
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
      embeds: [embeds.error('Permission Denied', 'Only support staff can claim tickets.')],
      flags: [MessageFlags.Ephemeral]
    });
  }

  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  try {
    await ticketService.claimTicket({
      ticket,
      member: interaction.member,
      channel: interaction.channel
    });

    const alertEmbed = embeds.success(
      'Ticket Claimed',
      `<@${interaction.user.id}> has claimed this ticket and will be assisting you.`
    );
    await interaction.channel.send({ embeds: [alertEmbed] });

    await interaction.editReply({
      embeds: [embeds.success('Claimed', 'You have successfully claimed this ticket.')]
    });
  } catch (error) {
    await interaction.editReply({
      embeds: [embeds.error('Claim Failed', error.message)]
    });
  }
}

export async function handleTicketUnclaimButton(interaction) {
  const channelId = interaction.customId.replace('ticket_unclaim_', '');
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
      embeds: [embeds.error('Permission Denied', 'Only support staff can unclaim tickets.')],
      flags: [MessageFlags.Ephemeral]
    });
  }

  if (ticket.claimedBy !== interaction.user.id && !interaction.member.permissions.has('Administrator')) {
    return interaction.reply({
      embeds: [embeds.error('Permission Denied', 'You can only unclaim tickets that you claimed.')],
      flags: [MessageFlags.Ephemeral]
    });
  }

  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  try {
    await ticketService.unclaimTicket({
      ticket,
      member: interaction.member,
      channel: interaction.channel
    });

    const alertEmbed = embeds.primary(
      'Ticket Unclaimed',
      `This ticket was unclaimed by <@${interaction.user.id}> and is now available for other staff.`
    );
    await interaction.channel.send({ embeds: [alertEmbed] });

    await interaction.editReply({
      embeds: [embeds.success('Unclaimed', 'You have unclaimed this ticket.')]
    });
  } catch (error) {
    await interaction.editReply({
      embeds: [embeds.error('Unclaim Failed', error.message)]
    });
  }
}
