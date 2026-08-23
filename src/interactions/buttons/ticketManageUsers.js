import {
  ActionRowBuilder,
  UserSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} from 'discord.js';
import { Ticket } from '../../models/Ticket.js';
import { ticketService } from '../../services/ticketService.js';
import { embeds } from '../../utils/embedBuilder.js';
import { canManageTicket } from '../../utils/permissionChecker.js';

export async function handleTicketManageUsersButton(interaction) {
  const channelId = interaction.customId.replace('ticket_members_btn_', '');
  const ticket = await Ticket.findOne({ channelId });

  if (!ticket) {
    return interaction.reply({
      embeds: [embeds.error('Not Found', 'No ticket data found for this channel.')],
      flags: [MessageFlags.Ephemeral]
    });
  }

  const isStaff = await canManageTicket(interaction.member, ticket);
  if (!isStaff && ticket.userId !== interaction.user.id) {
    return interaction.reply({
      embeds: [embeds.error('Permission Denied', 'You do not have permission to manage members.')],
      flags: [MessageFlags.Ephemeral]
    });
  }

  const addUserSelect = new UserSelectMenuBuilder()
    .setCustomId(`ticket_add_user_${channelId}`)
    .setPlaceholder('Select a user to ADD to this ticket...')
    .setMinValues(1)
    .setMaxValues(1);

  const row1 = new ActionRowBuilder().addComponents(addUserSelect);

  const removeUserSelect = new UserSelectMenuBuilder()
    .setCustomId(`ticket_remove_user_${channelId}`)
    .setPlaceholder('Select a user to REMOVE from this ticket...')
    .setMinValues(1)
    .setMaxValues(1);

  const row2 = new ActionRowBuilder().addComponents(removeUserSelect);

  const currentMembers = [
    `• Creator: <@${ticket.userId}>`,
    ...(ticket.addedUsers.length > 0
      ? ticket.addedUsers.map((id) => `• Added: <@${id}>`)
      : ['• No additional users added'])
  ].join('\n');

  const embed = embeds.primary(
    'Manage Ticket Members',
    `**Current Ticket Members:**\n${currentMembers}\n\n` +
    `Use the menus below to add or remove members.`
  );

  await interaction.reply({
    embeds: [embed],
    components: [row1, row2],
    flags: [MessageFlags.Ephemeral]
  });
}

export async function handleTicketAddUserSelect(interaction) {
  const channelId = interaction.customId.replace('ticket_add_user_', '');
  const targetUserId = interaction.values[0];

  const ticket = await Ticket.findOne({ channelId });
  if (!ticket) {
    return interaction.reply({
      embeds: [embeds.error('Not Found', 'No ticket data found for this channel.')],
      flags: [MessageFlags.Ephemeral]
    });
  }

  await interaction.deferUpdate();

  try {
    const targetUser = await interaction.client.users.fetch(targetUserId);
    await ticketService.addUser({
      ticket,
      targetUser,
      channel: interaction.channel,
      addedBy: interaction.user
    });

    await interaction.editReply({
      embeds: [embeds.success('User Added', `Successfully added <@${targetUserId}> to this ticket.`)],
      components: []
    });
  } catch (error) {
    await interaction.editReply({
      embeds: [embeds.error('Failed to Add User', error.message)],
      components: []
    });
  }
}

export async function handleTicketRemoveUserSelect(interaction) {
  const channelId = interaction.customId.replace('ticket_remove_user_', '');
  const targetUserId = interaction.values[0];

  const ticket = await Ticket.findOne({ channelId });
  if (!ticket) {
    return interaction.reply({
      embeds: [embeds.error('Not Found', 'No ticket data found for this channel.')],
      flags: [MessageFlags.Ephemeral]
    });
  }

  await interaction.deferUpdate();

  try {
    const targetUser = await interaction.client.users.fetch(targetUserId);
    await ticketService.removeUser({
      ticket,
      targetUser,
      channel: interaction.channel,
      removedBy: interaction.user
    });

    await interaction.editReply({
      embeds: [embeds.success('User Removed', `Successfully removed <@${targetUserId}> from this ticket.`)],
      components: []
    });
  } catch (error) {
    await interaction.editReply({
      embeds: [embeds.error('Failed to Remove User', error.message)],
      components: []
    });
  }
}
