import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  RoleSelectMenuBuilder,
  ChannelSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelType
} from 'discord.js';
import { config } from '../config/config.js';

// In-memory store for active admin wizard sessions and drafts
const activeDrafts = new Map();

export const wizardService = {
  getDraft(guildId, userId) {
    const key = `${guildId}_${userId}`;
    if (!activeDrafts.has(key)) {
      activeDrafts.set(key, { tempCategory: null, step: 1 });
    }
    return activeDrafts.get(key);
  },

  clearDraft(guildId, userId) {
    const key = `${guildId}_${userId}`;
    activeDrafts.delete(key);
  },

  buildStep1(guildConfig) {
    const adminRoles = guildConfig.adminRoleIds?.length > 0
      ? guildConfig.adminRoleIds.map((id) => `<@&${id}>`).join(', ')
      : 'None configured';

    const supportRoles = guildConfig.supportRoleIds?.length > 0
      ? guildConfig.supportRoleIds.map((id) => `<@&${id}>`).join(', ')
      : 'None configured';

    const logChannel = guildConfig.logChannelId
      ? `<#${guildConfig.logChannelId}>`
      : 'None configured';

    const mentionStatus = guildConfig.mentionStaff !== false
      ? '🟢 **Enabled** (Pings Admin & Category Support roles on ticket open)'
      : '🔴 **Disabled** (No staff pings on ticket open)';

    const embed = new EmbedBuilder()
      .setColor(config.bot.embedColor)
      .setTitle('⚙️ Setup Wizard: Step 1 of 3 | Server Settings')
      .setDescription(
        'Configure your global server settings, roles, and ticket limits below.\n' +
        'Use the menus and buttons to adjust settings, then click **Next: Categories**.'
      )
      .addFields(
        { name: '🔢 Max Tickets per User', value: `${guildConfig.ticketLimit || 3}`, inline: true },
        { name: '🔔 Mention Staff on Open', value: mentionStatus, inline: false },
        { name: '👑 Admin Roles', value: adminRoles, inline: true },
        { name: '🛡️ Global Support Roles', value: supportRoles, inline: true },
        { name: '📋 Log Channel', value: logChannel, inline: false }
      )
      .setFooter({ text: 'Step 1/3: Server Configuration' });

    // Buttons
    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard_edit_settings')
        .setLabel('Edit Limits')
        .setEmoji('⚙️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('wizard_toggle_mention')
        .setLabel(guildConfig.mentionStaff !== false ? 'Mention: ON' : 'Mention: OFF')
        .setEmoji('🔔')
        .setStyle(guildConfig.mentionStaff !== false ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('wizard_step_2')
        .setLabel('Next: Categories')
        .setEmoji('➡️')
        .setStyle(ButtonStyle.Primary)
    );

    // Admin Role Select Menu
    const adminRoleSelect = new RoleSelectMenuBuilder()
      .setCustomId('wizard_admin_role_select')
      .setPlaceholder('Assign Server Admin Roles...')
      .setMinValues(0)
      .setMaxValues(5);

    // Support Role Select Menu
    const supportRoleSelect = new RoleSelectMenuBuilder()
      .setCustomId('wizard_support_role_select')
      .setPlaceholder('Assign Global Support Roles...')
      .setMinValues(0)
      .setMaxValues(5);

    // Log Channel Select Menu
    const logChannelSelect = new ChannelSelectMenuBuilder()
      .setCustomId('wizard_log_channel_select')
      .setPlaceholder('Assign Ticket Log Channel...')
      .addChannelTypes(ChannelType.GuildText)
      .setMinValues(0)
      .setMaxValues(1);

    return {
      embeds: [embed],
      components: [
        buttonRow,
        new ActionRowBuilder().addComponents(adminRoleSelect),
        new ActionRowBuilder().addComponents(supportRoleSelect),
        new ActionRowBuilder().addComponents(logChannelSelect)
      ]
    };
  },

  buildStep2(guildConfig, adminId) {
    const draft = this.getDraft(guildConfig.guildId, adminId);

    // If there is an active category draft in progress
    if (draft.tempCategory) {
      return this.buildCategoryDraftView(draft.tempCategory);
    }

    const categories = guildConfig.categories || [];

    const categoryList = categories.length > 0
      ? categories.map((cat, idx) => {
          const desc = cat.description ? `\n> ${cat.description}` : '\n> *No description set*';
          return `**${idx + 1}. ${cat.emoji || '🎫'} ${cat.label}**${desc}`;
        }).join('\n\n')
      : 'No categories added yet. Click **Add Category** below to create your first ticket option.';

    const embed = new EmbedBuilder()
      .setColor(config.bot.embedColor)
      .setTitle(`📁 Setup Wizard: Step 2 of 3 | Ticket Categories (${categories.length})`)
      .setDescription(
        'Manage the buttons and categories that appear on your ticket panel.\n' +
        'Click **Add Category** to create a new one, or select a category below to **Edit** or **Delete**.'
      )
      .addFields({ name: 'Active Categories', value: categoryList, inline: false })
      .setFooter({ text: 'Step 2/3: Ticket Categories' });

    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard_add_category_btn')
        .setLabel('Add Category')
        .setEmoji('➕')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('wizard_step_1')
        .setLabel('Back to Settings')
        .setEmoji('⬅️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('wizard_step_3')
        .setLabel('Next: Deploy Panel')
        .setEmoji('➡️')
        .setStyle(ButtonStyle.Primary)
    );

    const components = [buttonRow];

    if (categories.length > 0) {
      const editOptions = categories.map((c) => {
        return new StringSelectMenuOptionBuilder()
          .setLabel(c.label.substring(0, 100))
          .setValue(c.id)
          .setDescription((c.description || 'Edit this category').substring(0, 100))
          .setEmoji(c.emoji || '🎫');
      });

      const editSelect = new StringSelectMenuBuilder()
        .setCustomId('wizard_edit_category_select')
        .setPlaceholder('Select a category to EDIT...')
        .addOptions(editOptions);

      const removeOptions = categories.map((c) => {
        return new StringSelectMenuOptionBuilder()
          .setLabel(c.label.substring(0, 100))
          .setValue(c.id)
          .setDescription((c.description || 'Delete this category').substring(0, 100))
          .setEmoji(c.emoji || '🗑️');
      });

      const removeSelect = new StringSelectMenuBuilder()
        .setCustomId('wizard_remove_category_select')
        .setPlaceholder('Select a category to DELETE...')
        .addOptions(removeOptions);

      components.push(new ActionRowBuilder().addComponents(editSelect));
      components.push(new ActionRowBuilder().addComponents(removeSelect));
    }

    return { embeds: [embed], components };
  },

  buildCategoryDraftView(tempCat) {
    const roleText = tempCat.supportRoleId ? `<@&${tempCat.supportRoleId}>` : 'Global Support Roles (default)';
    const channelText = tempCat.channelCategoryId ? `<#${tempCat.channelCategoryId}>` : 'Server Default (root)';

    const questions = tempCat.questions || [];
    let questionsText = 'No custom questions configured (will prompt for Subject by default).';

    if (questions.length > 0) {
      questionsText = questions
        .map((q, idx) => `**Q${idx + 1}:** "${q.label}" (Style: \`${q.style}\`, Required: \`${q.required ? 'Yes' : 'No'}\`)`)
        .join('\n');
    }

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`🛠️ Category Builder: ${tempCat.emoji || '🎫'} ${tempCat.label || 'New Category'}`)
      .setDescription(
        'Configure this ticket category below.\n' +
        '1. Click **Basic Info** to set Name, Emoji, and Description.\n' +
        '2. Click **Q1 to Q5** buttons to configure up to 5 modal questions.\n' +
        '3. Select staff role and parent category channel.\n' +
        '4. Click **Save Category** to commit.'
      )
      .addFields(
        { name: '📌 Category Name', value: tempCat.label || 'Not set', inline: true },
        { name: '🏷️ Emoji & ID', value: `${tempCat.emoji || '🎫'} (\`${tempCat.id || 'auto'}\`)`, inline: true },
        { name: '📝 Description', value: tempCat.description || 'None provided', inline: false },
        { name: `❓ Configured Questions (${questions.length}/5)`, value: questionsText, inline: false },
        { name: '🛡️ Assigned Support Role', value: roleText, inline: true },
        { name: '📁 Target Discord Category', value: channelText, inline: true }
      )
      .setFooter({ text: 'Configure options and click Save Category when done.' });

    // Row 1: Basic Info Button
    const infoRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard_draft_edit_info')
        .setLabel('Basic Info (Name/Emoji/Desc)')
        .setEmoji('✏️')
        .setStyle(ButtonStyle.Primary)
    );

    // Row 2: 5 Question Buttons
    const questionButtons = [1, 2, 3, 4, 5].map((num) => {
      const isConfigured = questions[num - 1] != null;
      return new ButtonBuilder()
        .setCustomId(`wizard_draft_q_${num}`)
        .setLabel(`Question ${num}`)
        .setEmoji(isConfigured ? '✅' : '❓')
        .setStyle(isConfigured ? ButtonStyle.Success : ButtonStyle.Secondary);
    });

    const questionRow = new ActionRowBuilder().addComponents(questionButtons);

    // Row 3: Role Select Menu
    const roleSelect = new RoleSelectMenuBuilder()
      .setCustomId('wizard_draft_role_select')
      .setPlaceholder('Assign Support Role for this category (optional)...')
      .setMinValues(0)
      .setMaxValues(1);

    // Row 4: Channel Category Select Menu
    const channelSelect = new ChannelSelectMenuBuilder()
      .setCustomId('wizard_draft_channel_category_select')
      .setPlaceholder('Select Discord Category Channel (optional)...')
      .addChannelTypes(ChannelType.GuildCategory)
      .setMinValues(0)
      .setMaxValues(1);

    // Row 5: Action Buttons (Save / Cancel)
    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard_save_category_btn')
        .setLabel('Save Category')
        .setEmoji('💾')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('wizard_cancel_draft_btn')
        .setLabel('Cancel')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger)
    );

    return {
      embeds: [embed],
      components: [
        infoRow,
        questionRow,
        new ActionRowBuilder().addComponents(roleSelect),
        new ActionRowBuilder().addComponents(channelSelect),
        actionRow
      ]
    };
  },

  buildStep3(guildConfig) {
    const title = guildConfig.panelSettings?.title || 'Support Ticket Center';
    const description = guildConfig.panelSettings?.description ||
      'Need assistance? Select an option or click a button below to create a support ticket.';
    const color = guildConfig.panelSettings?.color || config.bot.embedColor;
    const mode = guildConfig.panelSettings?.mode || 'BUTTONS';
    const categories = guildConfig.categories || [];

    const previewEmbed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`🎫 ${title}`)
      .setDescription(description)
      .setFooter({ text: 'Preview of Ticket Panel' });

    if (categories.length === 0) {
      previewEmbed.addFields({
        name: '⚠️ No Categories',
        value: 'Please go back to Step 2 and add at least one category before deploying.'
      });
    }

    const infoEmbed = new EmbedBuilder()
      .setColor(config.bot.embedColor)
      .setTitle('📤 Setup Wizard: Step 3 of 3 | Panel Deployment')
      .setDescription(
        'Customize your panel text or switch display mode below.\n' +
        'When you are ready, choose a channel from the menu to send the live ticket panel.'
      )
      .addFields(
        { name: '🔘 Display Mode', value: mode === 'BUTTONS' ? 'Clickable Buttons' : 'Dropdown Select Menu', inline: true },
        { name: '🎨 Accent Color', value: color, inline: true },
        { name: '📁 Category Buttons', value: `${categories.length} configured`, inline: true }
      )
      .setFooter({ text: 'Step 3/3: Panel Deployment' });

    const buttonRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('wizard_edit_panel_text')
        .setLabel('Edit Panel Text')
        .setEmoji('✏️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('wizard_toggle_mode')
        .setLabel(`Mode: ${mode === 'BUTTONS' ? 'Buttons' : 'Dropdown'}`)
        .setEmoji('🔘')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('wizard_step_2')
        .setLabel('Back to Categories')
        .setEmoji('⬅️')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId('wizard_finish_btn')
        .setLabel('Finish')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success)
    );

    const deploySelect = new ChannelSelectMenuBuilder()
      .setCustomId('wizard_deploy_channel_select')
      .setPlaceholder('Choose a channel to SEND this panel to...')
      .addChannelTypes(ChannelType.GuildText)
      .setMinValues(1)
      .setMaxValues(1);

    return {
      embeds: [infoEmbed, previewEmbed],
      components: [
        buttonRow,
        new ActionRowBuilder().addComponents(deploySelect)
      ]
    };
  }
};
