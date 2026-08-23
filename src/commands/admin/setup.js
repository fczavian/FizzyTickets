import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { GuildConfig } from '../../models/GuildConfig.js';
import { wizardService } from '../../services/wizardService.js';
import { embeds } from '../../utils/embedBuilder.js';
import { isGuildAdmin } from '../../utils/permissionChecker.js';

export default {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Launch the interactive 3-step ticket setup wizard')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction) {
    const isAdmin = await isGuildAdmin(interaction.member);
    if (!isAdmin) {
      return interaction.reply({
        embeds: [embeds.error('Permission Denied', 'Only administrators can run the setup wizard.')],
        flags: [MessageFlags.Ephemeral]
      });
    }

    let guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
    if (!guildConfig) {
      guildConfig = await GuildConfig.create({ guildId: interaction.guild.id });
    }

    // Reset draft and start at Step 1
    const draft = wizardService.getDraft(interaction.guild.id, interaction.user.id);
    draft.tempCategory = null;
    draft.step = 1;

    const view = wizardService.buildStep1(guildConfig);

    await interaction.reply({
      ...view,
      flags: [MessageFlags.Ephemeral]
    });
  }
};
