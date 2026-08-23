import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  MessageFlags
} from 'discord.js';
import { GuildConfig } from '../../models/GuildConfig.js';
import { TicketPanel } from '../../models/TicketPanel.js';
import { wizardService } from '../../services/wizardService.js';
import { embeds } from '../../utils/embedBuilder.js';
import { config } from '../../config/config.js';

export async function handleWizardSelect(interaction) {
  const customId = interaction.customId;

  let guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
  if (!guildConfig) {
    guildConfig = await GuildConfig.create({ guildId: interaction.guild.id });
  }

  // 1. Admin Role Select (Step 1)
  if (customId === 'wizard_admin_role_select') {
    guildConfig.adminRoleIds = interaction.values;
    await guildConfig.save();

    const view = wizardService.buildStep1(guildConfig);
    return await interaction.update(view);
  }

  // 2. Global Support Role Select (Step 1)
  if (customId === 'wizard_support_role_select') {
    guildConfig.supportRoleIds = interaction.values;
    await guildConfig.save();

    const view = wizardService.buildStep1(guildConfig);
    return await interaction.update(view);
  }

  // 3. Log Channel Select (Step 1)
  if (customId === 'wizard_log_channel_select') {
    guildConfig.logChannelId = interaction.values[0] || null;
    await guildConfig.save();

    const view = wizardService.buildStep1(guildConfig);
    return await interaction.update(view);
  }

  // 4. Draft Category Support Role Select (Step 2 Draft)
  if (customId === 'wizard_draft_role_select') {
    const draft = wizardService.getDraft(interaction.guild.id, interaction.user.id);
    if (draft.tempCategory) {
      draft.tempCategory.supportRoleId = interaction.values[0] || null;
    }

    const view = wizardService.buildStep2(guildConfig, interaction.user.id);
    return await interaction.update(view);
  }

  // 5. Draft Discord Category Channel Select (Step 2 Draft)
  if (customId === 'wizard_draft_channel_category_select') {
    const draft = wizardService.getDraft(interaction.guild.id, interaction.user.id);
    if (draft.tempCategory) {
      draft.tempCategory.channelCategoryId = interaction.values[0] || null;
    }

    const view = wizardService.buildStep2(guildConfig, interaction.user.id);
    return await interaction.update(view);
  }

  // 6. Edit Category Select (Step 2 Overview -> Opens Builder prefilled)
  if (customId === 'wizard_edit_category_select') {
    const categoryIdToEdit = interaction.values[0];
    const category = (guildConfig.categories || []).find((c) => c.id === categoryIdToEdit);

    if (!category) {
      return interaction.reply({
        embeds: [embeds.error('Category Not Found', 'The selected category could not be found.')],
        flags: [MessageFlags.Ephemeral]
      });
    }

    const draft = wizardService.getDraft(interaction.guild.id, interaction.user.id);
    draft.tempCategory = {
      id: category.id,
      label: category.label,
      emoji: category.emoji || '🎫',
      description: category.description || '',
      questions: category.questions ? JSON.parse(JSON.stringify(category.questions)) : [],
      supportRoleId: category.supportRoleIds?.[0] || null,
      channelCategoryId: category.channelCategoryId || null
    };

    const view = wizardService.buildStep2(guildConfig, interaction.user.id);
    return await interaction.update(view);
  }

  // 6b. Remove Category Select (Step 2)
  if (customId === 'wizard_remove_category_select') {
    const categoryIdToRemove = interaction.values[0];
    guildConfig.categories = (guildConfig.categories || []).filter((c) => c.id !== categoryIdToRemove);
    await guildConfig.save();

    const view = wizardService.buildStep2(guildConfig, interaction.user.id);
    return await interaction.update(view);
  }

  // 7. Deploy Panel Channel Select (Step 3)
  if (customId === 'wizard_deploy_channel_select') {
    const targetChannelId = interaction.values[0];
    const targetChannel = await interaction.guild.channels.fetch(targetChannelId).catch(() => null);

    if (!targetChannel || !targetChannel.isTextBased()) {
      return interaction.reply({
        embeds: [embeds.error('Invalid Channel', 'Please select a valid text channel.')],
        flags: [MessageFlags.Ephemeral]
      });
    }

    const categories = guildConfig.categories || [];
    if (categories.length === 0) {
      return interaction.reply({
        embeds: [embeds.error('No Categories', 'Cannot deploy panel without at least one category. Please add categories in Step 2.')],
        flags: [MessageFlags.Ephemeral]
      });
    }

    await interaction.deferUpdate();

    const title = guildConfig.panelSettings?.title || 'Support Ticket Center';
    const description = guildConfig.panelSettings?.description ||
      'Need assistance? Select an option or click a button below to create a support ticket.';
    const color = guildConfig.panelSettings?.color || config.bot.embedColor;
    const mode = guildConfig.panelSettings?.mode || 'BUTTONS';

    const panelEmbed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`🎫 ${title}`)
      .setDescription(description)
      .setFooter({ text: interaction.guild.name, iconURL: interaction.guild.iconURL() || null })
      .setTimestamp();

    let components = [];

    if (mode === 'DROPDOWN') {
      const options = categories.map((cat) => {
        const opt = new StringSelectMenuOptionBuilder()
          .setLabel(cat.label.substring(0, 100))
          .setValue(cat.id)
          .setDescription((cat.description || 'Open a support ticket').substring(0, 100));

        if (cat.emoji) {
          opt.setEmoji(cat.emoji);
        }
        return opt;
      });

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('ticket_panel_dropdown')
        .setPlaceholder('Select a ticket category...')
        .addOptions(options);

      components = [new ActionRowBuilder().addComponents(selectMenu)];
    } else {
      // Buttons mode
      const buttonStyles = [
        ButtonStyle.Primary,
        ButtonStyle.Success,
        ButtonStyle.Secondary,
        ButtonStyle.Danger
      ];

      const rows = [];
      let currentRow = new ActionRowBuilder();

      categories.forEach((cat, index) => {
        if (currentRow.components.length === 5) {
          rows.push(currentRow);
          currentRow = new ActionRowBuilder();
        }

        const style = buttonStyles[index % buttonStyles.length];
        const btn = new ButtonBuilder()
          .setCustomId(`ticket_open_btn_${cat.id}`)
          .setLabel(cat.label.substring(0, 80))
          .setStyle(style);

        if (cat.emoji) {
          btn.setEmoji(cat.emoji);
        }

        currentRow.addComponents(btn);
      });

      if (currentRow.components.length > 0) {
        rows.push(currentRow);
      }

      components = rows;
    }

    try {
      const sentMessage = await targetChannel.send({
        embeds: [panelEmbed],
        components
      });

      await TicketPanel.create({
        guildId: interaction.guild.id,
        channelId: targetChannel.id,
        messageId: sentMessage.id,
        title,
        description,
        categoryIds: categories.map((c) => c.id),
        placeholder: 'Select a ticket category...'
      });

      const successEmbed = embeds.success(
        'Panel Deployed',
        `Your ticket panel was sent to <#${targetChannel.id}> with **${categories.length} categories**.`
      );

      await interaction.followUp({
        embeds: [successEmbed],
        flags: [MessageFlags.Ephemeral]
      });
    } catch (err) {
      await interaction.followUp({
        embeds: [embeds.error('Failed to Deploy', err.message)],
        flags: [MessageFlags.Ephemeral]
      });
    }
  }
}
