import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags
} from 'discord.js';
import { Blacklist } from '../../models/Blacklist.js';
import { config } from '../../config/config.js';
import { embeds } from '../../utils/embedBuilder.js';
import { isGuildAdmin } from '../../utils/permissionChecker.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ticket-blacklist')
    .setDescription('Manage users blocked from creating tickets')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Blacklist a user from opening tickets')
        .addUserOption((opt) =>
          opt
            .setName('user')
            .setDescription('User to blacklist')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('reason')
            .setDescription('Reason for the blacklist')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a user from ticket blacklist')
        .addUserOption((opt) =>
          opt
            .setName('user')
            .setDescription('User to unblock')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('List all blacklisted users in this server')
    ),

  async execute(interaction) {
    if (!config.features.blacklist.enabled) {
      return interaction.reply({
        embeds: [embeds.error('Feature Disabled', 'The blacklist system is disabled in config.yml.')],
        flags: [MessageFlags.Ephemeral]
      });
    }

    const isAdmin = await isGuildAdmin(interaction.member);
    if (!isAdmin) {
      return interaction.reply({
        embeds: [embeds.error('Permission Denied', 'Only administrators can manage the ticket blacklist.')],
        flags: [MessageFlags.Ephemeral]
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'add') {
      const targetUser = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason provided';

      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

      const existing = await Blacklist.findOne({
        guildId: interaction.guild.id,
        userId: targetUser.id
      });

      if (existing) {
        return interaction.editReply({
          embeds: [embeds.warning('Already Blacklisted', `<@${targetUser.id}> is already on the blacklist.`)]
        });
      }

      await Blacklist.create({
        guildId: interaction.guild.id,
        userId: targetUser.id,
        reason,
        addedBy: interaction.user.id
      });

      return interaction.editReply({
        embeds: [embeds.success('User Blacklisted', `<@${targetUser.id}> was added to the blacklist.\n**Reason:** ${reason}`)]
      });
    }

    if (subcommand === 'remove') {
      const targetUser = interaction.options.getUser('user');

      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

      const result = await Blacklist.deleteOne({
        guildId: interaction.guild.id,
        userId: targetUser.id
      });

      if (result.deletedCount === 0) {
        return interaction.editReply({
          embeds: [embeds.error('Not Found', `<@${targetUser.id}> is not in the blacklist.`)]
        });
      }

      return interaction.editReply({
        embeds: [embeds.success('Blacklist Removed', `<@${targetUser.id}> was removed from the blacklist.`)]
      });
    }

    if (subcommand === 'list') {
      await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

      const list = await Blacklist.find({ guildId: interaction.guild.id }).lean();

      if (list.length === 0) {
        return interaction.editReply({
          embeds: [embeds.primary('Ticket Blacklist', 'No users are currently blacklisted in this server.')]
        });
      }

      const formatted = list.map((entry, index) => {
        return `${index + 1}. <@${entry.userId}> (\`${entry.userId}\`)\n• Reason: ${entry.reason}\n• Added by: <@${entry.addedBy}>`;
      }).join('\n\n');

      const embed = embeds.primary(`Blacklisted Users (${list.length})`, formatted);
      return interaction.editReply({ embeds: [embed] });
    }
  }
};
