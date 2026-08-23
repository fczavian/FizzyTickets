import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { Ticket } from '../../models/Ticket.js';
import { ticketService } from '../../services/ticketService.js';
import { embeds } from '../../utils/embedBuilder.js';
import { canManageTicket } from '../../utils/permissionChecker.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Manage active ticket channels')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add a user to the current ticket')
        .addUserOption((opt) =>
          opt
            .setName('user')
            .setDescription('User to add')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a user from the current ticket')
        .addUserOption((opt) =>
          opt
            .setName('user')
            .setDescription('User to remove')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('rename')
        .setDescription('Rename the ticket channel')
        .addStringOption((opt) =>
          opt
            .setName('name')
            .setDescription('New channel name')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('priority')
        .setDescription('Change the priority level of this ticket')
        .addStringOption((opt) =>
          opt
            .setName('level')
            .setDescription('Priority urgency level')
            .addChoices(
              { name: 'Low', value: 'LOW' },
              { name: 'Medium', value: 'MEDIUM' },
              { name: 'High', value: 'HIGH' },
              { name: 'Urgent', value: 'URGENT' }
            )
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('claim')
        .setDescription('Claim this ticket for yourself')
    )
    .addSubcommand((sub) =>
      sub
        .setName('unclaim')
        .setDescription('Release your claim on this ticket')
    )
    .addSubcommand((sub) =>
      sub
        .setName('close')
        .setDescription('Close the current ticket')
        .addStringOption((opt) =>
          opt
            .setName('reason')
            .setDescription('Reason for closing')
            .setRequired(false)
        )
    ),

  async execute(interaction) {
    const ticket = await Ticket.findOne({ channelId: interaction.channel.id });

    if (!ticket) {
      return interaction.reply({
        embeds: [embeds.error('Not a Ticket', 'This command can only be used inside an active ticket channel.')],
        flags: [MessageFlags.Ephemeral]
      });
    }

    const subcommand = interaction.options.getSubcommand();

    // Check staff permissions
    const isStaff = await canManageTicket(interaction.member, ticket);
    const isCreator = ticket.userId === interaction.user.id;

    if (subcommand === 'close') {
      if (!isStaff && !isCreator) {
        return interaction.reply({
          embeds: [embeds.error('Permission Denied', 'You do not have permission to close this ticket.')],
          flags: [MessageFlags.Ephemeral]
        });
      }

      const reason = interaction.options.getString('reason') || 'Closed by user/staff';
      await interaction.deferReply();

      try {
        await ticketService.closeTicket({
          ticket,
          channel: interaction.channel,
          closedByUser: interaction.user,
          reason
        });

        return interaction.editReply({
          embeds: [embeds.success('Ticket Closed', 'Ticket closed and transcript saved.')]
        });
      } catch (error) {
        return interaction.editReply({
          embeds: [embeds.error('Failed to Close', error.message)]
        });
      }
    }

    // All other subcommands require staff permissions
    if (!isStaff) {
      return interaction.reply({
        embeds: [embeds.error('Permission Denied', 'Only support staff can use this command.')],
        flags: [MessageFlags.Ephemeral]
      });
    }

    if (subcommand === 'add') {
      const targetUser = interaction.options.getUser('user');
      await interaction.deferReply();

      try {
        await ticketService.addUser({
          ticket,
          targetUser,
          channel: interaction.channel,
          addedBy: interaction.user
        });

        return interaction.editReply({
          embeds: [embeds.success('User Added', `<@${targetUser.id}> was added to the ticket.`)]
        });
      } catch (error) {
        return interaction.editReply({
          embeds: [embeds.error('Failed to Add User', error.message)]
        });
      }
    }

    if (subcommand === 'remove') {
      const targetUser = interaction.options.getUser('user');
      await interaction.deferReply();

      try {
        await ticketService.removeUser({
          ticket,
          targetUser,
          channel: interaction.channel,
          removedBy: interaction.user
        });

        return interaction.editReply({
          embeds: [embeds.success('User Removed', `<@${targetUser.id}> was removed from the ticket.`)]
        });
      } catch (error) {
        return interaction.editReply({
          embeds: [embeds.error('Failed to Remove User', error.message)]
        });
      }
    }

    if (subcommand === 'rename') {
      const newName = interaction.options.getString('name');
      await interaction.deferReply();

      try {
        await ticketService.renameTicket({
          ticket,
          newName,
          channel: interaction.channel,
          renamedBy: interaction.user
        });

        return interaction.editReply({
          embeds: [embeds.success('Ticket Renamed', `Channel renamed to **#${newName}**.`)]
        });
      } catch (error) {
        return interaction.editReply({
          embeds: [embeds.error('Failed to Rename', error.message)]
        });
      }
    }

    if (subcommand === 'priority') {
      const level = interaction.options.getString('level');
      await interaction.deferReply();

      try {
        await ticketService.setPriority({
          ticket,
          priority: level,
          member: interaction.member,
          channel: interaction.channel
        });

        return interaction.editReply({
          embeds: [embeds.success('Priority Updated', `Priority set to **${level}**.`)]
        });
      } catch (error) {
        return interaction.editReply({
          embeds: [embeds.error('Failed to Update Priority', error.message)]
        });
      }
    }

    if (subcommand === 'claim') {
      await interaction.deferReply();

      try {
        await ticketService.claimTicket({
          ticket,
          member: interaction.member,
          channel: interaction.channel
        });

        return interaction.editReply({
          embeds: [embeds.success('Ticket Claimed', 'You have claimed this ticket.')]
        });
      } catch (error) {
        return interaction.editReply({
          embeds: [embeds.error('Claim Failed', error.message)]
        });
      }
    }

    if (subcommand === 'unclaim') {
      await interaction.deferReply();

      try {
        await ticketService.unclaimTicket({
          ticket,
          member: interaction.member,
          channel: interaction.channel
        });

        return interaction.editReply({
          embeds: [embeds.success('Ticket Unclaimed', 'You have unclaimed this ticket.')]
        });
      } catch (error) {
        return interaction.editReply({
          embeds: [embeds.error('Unclaim Failed', error.message)]
        });
      }
    }
  }
};
