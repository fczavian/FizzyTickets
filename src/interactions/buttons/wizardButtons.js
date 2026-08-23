import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags
} from 'discord.js';
import { GuildConfig } from '../../models/GuildConfig.js';
import { wizardService } from '../../services/wizardService.js';
import { embeds } from '../../utils/embedBuilder.js';
import { isGuildAdmin } from '../../utils/permissionChecker.js';

export async function handleWizardButton(interaction) {
  const isAdmin = await isGuildAdmin(interaction.member);
  if (!isAdmin) {
    return interaction.reply({
      embeds: [embeds.error('Permission Denied', 'Only administrators can use the setup wizard.')],
      flags: [MessageFlags.Ephemeral]
    });
  }

  const customId = interaction.customId;
  let guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
  if (!guildConfig) {
    guildConfig = await GuildConfig.create({ guildId: interaction.guild.id });
  }

  // 1. Navigation Steps
  if (customId === 'wizard_step_1') {
    const draft = wizardService.getDraft(interaction.guild.id, interaction.user.id);
    draft.step = 1;
    const view = wizardService.buildStep1(guildConfig);
    return await interaction.update(view);
  }

  if (customId === 'wizard_step_2') {
    const draft = wizardService.getDraft(interaction.guild.id, interaction.user.id);
    draft.step = 2;
    const view = wizardService.buildStep2(guildConfig, interaction.user.id);
    return await interaction.update(view);
  }

  if (customId === 'wizard_step_3') {
    const draft = wizardService.getDraft(interaction.guild.id, interaction.user.id);
    draft.step = 3;
    const view = wizardService.buildStep3(guildConfig);
    return await interaction.update(view);
  }

  // 2. Toggle Mention Staff
  if (customId === 'wizard_toggle_mention') {
    guildConfig.mentionStaff = guildConfig.mentionStaff === false ? true : false;
    await guildConfig.save();

    const view = wizardService.buildStep1(guildConfig);
    return await interaction.update(view);
  }

  // 3. Edit Settings Modal (Step 1)
  if (customId === 'wizard_edit_settings') {
    const modal = new ModalBuilder()
      .setCustomId('wizard_edit_settings_modal')
      .setTitle('Edit Server Ticket Settings');

    const limitInput = new TextInputBuilder()
      .setCustomId('settings_ticket_limit')
      .setLabel('Max Open Tickets per User')
      .setPlaceholder('Enter a number (e.g. 3)')
      .setValue(String(guildConfig.ticketLimit || 3))
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(2);

    modal.addComponents(new ActionRowBuilder().addComponents(limitInput));
    return await interaction.showModal(modal);
  }

  // 4. Add Category Button (Step 2 -> Transition to Category Builder)
  if (customId === 'wizard_add_category_btn') {
    const draft = wizardService.getDraft(interaction.guild.id, interaction.user.id);
    draft.tempCategory = {
      id: '',
      label: '',
      emoji: '🎫',
      description: '',
      questions: [],
      supportRoleId: null,
      channelCategoryId: null
    };

    const view = wizardService.buildStep2(guildConfig, interaction.user.id);
    return await interaction.update(view);
  }

  // 4b. Category Builder: Edit Basic Info Modal Trigger
  if (customId === 'wizard_draft_edit_info') {
    const draft = wizardService.getDraft(interaction.guild.id, interaction.user.id);
    const temp = draft.tempCategory || {};

    const modal = new ModalBuilder()
      .setCustomId('wizard_modal_category_info')
      .setTitle('Category Info');

    const nameInput = new TextInputBuilder()
      .setCustomId('category_name')
      .setLabel('Category Name (max 45 chars)')
      .setPlaceholder('e.g. General Support, Billing, Bug Report')
      .setValue(temp.label || '')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(45);

    const emojiInput = new TextInputBuilder()
      .setCustomId('category_emoji')
      .setLabel('Category Emoji')
      .setPlaceholder('e.g. 💬, 💳, 🐛')
      .setValue(temp.emoji || '🎫')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(10);

    const descInput = new TextInputBuilder()
      .setCustomId('category_description')
      .setLabel('Description (shown on dropdown, max 100)')
      .setPlaceholder('Brief summary of what this ticket option is for')
      .setValue(temp.description || '')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(100);

    modal.addComponents(
      new ActionRowBuilder().addComponents(nameInput),
      new ActionRowBuilder().addComponents(emojiInput),
      new ActionRowBuilder().addComponents(descInput)
    );

    return await interaction.showModal(modal);
  }

  // 4c. Category Builder: Question Modal Triggers (Q1 to Q5)
  if (customId.startsWith('wizard_draft_q_')) {
    const qNum = parseInt(customId.replace('wizard_draft_q_', ''), 10);
    const draft = wizardService.getDraft(interaction.guild.id, interaction.user.id);
    const temp = draft.tempCategory || {};
    const existingQ = temp.questions?.[qNum - 1] || {};

    const modal = new ModalBuilder()
      .setCustomId(`wizard_modal_question_${qNum}`)
      .setTitle(`Configure Question ${qNum}`);

    const labelInput = new TextInputBuilder()
      .setCustomId('q_label')
      .setLabel('Question Prompt (max 45 chars)')
      .setPlaceholder('e.g. What is your issue or username?')
      .setValue(existingQ.label || '')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(45);

    const placeholderInput = new TextInputBuilder()
      .setCustomId('q_placeholder')
      .setLabel('Placeholder Text (max 100 chars, optional)')
      .setPlaceholder('e.g. Provide details here')
      .setValue(existingQ.placeholder || '')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(100);

    const styleInput = new TextInputBuilder()
      .setCustomId('q_style')
      .setLabel('Answer Type (Type "SHORT" or "PARAGRAPH")')
      .setPlaceholder('SHORT or PARAGRAPH')
      .setValue(existingQ.style || 'SHORT')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(15);

    const requiredInput = new TextInputBuilder()
      .setCustomId('q_required')
      .setLabel('Is Answer Required? (Type "YES" or "NO")')
      .setPlaceholder('YES or NO')
      .setValue(existingQ.required !== false ? 'YES' : 'NO')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(10);

    modal.addComponents(
      new ActionRowBuilder().addComponents(labelInput),
      new ActionRowBuilder().addComponents(placeholderInput),
      new ActionRowBuilder().addComponents(styleInput),
      new ActionRowBuilder().addComponents(requiredInput)
    );

    return await interaction.showModal(modal);
  }

  // 5. Save Category Button (Step 2 Draft Commit)
  if (customId === 'wizard_save_category_btn') {
    const draft = wizardService.getDraft(interaction.guild.id, interaction.user.id);
    if (!draft.tempCategory) {
      return interaction.reply({
        embeds: [embeds.error('No Active Draft', 'No category draft was found to save.')],
        flags: [MessageFlags.Ephemeral]
      });
    }

    const temp = draft.tempCategory;
    if (!temp.label || !temp.label.trim()) {
      return interaction.reply({
        embeds: [
          embeds.error(
            'Missing Category Info',
            'Please click **Basic Info (Name/Emoji/Desc)** and enter a category name before saving.'
          )
        ],
        flags: [MessageFlags.Ephemeral]
      });
    }

    const slug = temp.id || temp.label.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || `cat-${Date.now()}`;

    const finalQuestions = (temp.questions && temp.questions.length > 0)
      ? temp.questions
      : [
          {
            label: 'Brief Subject',
            placeholder: 'Summarize your issue',
            style: 'SHORT',
            required: true
          }
        ];

    const newCategory = {
      id: slug,
      label: temp.label.trim(),
      emoji: temp.emoji || '🎫',
      description: temp.description || '',
      questions: finalQuestions,
      modalSubjectLabel: finalQuestions[0]?.label || 'Subject',
      modalDescriptionLabel: finalQuestions[1]?.label || 'Detailed Description',
      supportRoleIds: temp.supportRoleId ? [temp.supportRoleId] : [],
      channelCategoryId: temp.channelCategoryId || null,
      namingFormat: `${slug}-{counter}`,
      defaultPriority: 'MEDIUM'
    };

    // Remove any existing category with same id
    guildConfig.categories = (guildConfig.categories || []).filter((c) => c.id !== slug);
    guildConfig.categories.push(newCategory);
    await guildConfig.save();

    // Clear draft
    draft.tempCategory = null;

    const view = wizardService.buildStep2(guildConfig, interaction.user.id);
    return await interaction.update(view);
  }

  // 6. Cancel Draft Button
  if (customId === 'wizard_cancel_draft_btn') {
    const draft = wizardService.getDraft(interaction.guild.id, interaction.user.id);
    draft.tempCategory = null;

    const view = wizardService.buildStep2(guildConfig, interaction.user.id);
    return await interaction.update(view);
  }

  // 7. Edit Panel Text Modal (Step 3)
  if (customId === 'wizard_edit_panel_text') {
    const modal = new ModalBuilder()
      .setCustomId('wizard_edit_panel_modal')
      .setTitle('Edit Panel Embed Appearance');

    const titleInput = new TextInputBuilder()
      .setCustomId('panel_title')
      .setLabel('Panel Title')
      .setPlaceholder('e.g. Support Ticket Center')
      .setValue(guildConfig.panelSettings?.title || 'Support Ticket Center')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100);

    const descInput = new TextInputBuilder()
      .setCustomId('panel_desc')
      .setLabel('Panel Description')
      .setPlaceholder('Message body shown on the ticket panel embed')
      .setValue(guildConfig.panelSettings?.description || 'Select an option or click a button below to open a ticket.')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(1000);

    const colorInput = new TextInputBuilder()
      .setCustomId('panel_color')
      .setLabel('Accent Color (Hex)')
      .setPlaceholder('#5865F2')
      .setValue(guildConfig.panelSettings?.color || '#5865F2')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(7);

    modal.addComponents(
      new ActionRowBuilder().addComponents(titleInput),
      new ActionRowBuilder().addComponents(descInput),
      new ActionRowBuilder().addComponents(colorInput)
    );

    return await interaction.showModal(modal);
  }

  // 8. Toggle Display Mode (Step 3)
  if (customId === 'wizard_toggle_mode') {
    const currentMode = guildConfig.panelSettings?.mode || 'BUTTONS';
    const newMode = currentMode === 'BUTTONS' ? 'DROPDOWN' : 'BUTTONS';

    if (!guildConfig.panelSettings) {
      guildConfig.panelSettings = {};
    }
    guildConfig.panelSettings.mode = newMode;
    await guildConfig.save();

    const view = wizardService.buildStep3(guildConfig);
    return await interaction.update(view);
  }

  // 9. Finish Setup
  if (customId === 'wizard_finish_btn') {
    wizardService.clearDraft(interaction.guild.id, interaction.user.id);
    const finishEmbed = embeds.success(
      'Setup Complete',
      'The setup wizard session has ended. Your server settings and ticket panels are configured and active.'
    );
    return await interaction.update({
      embeds: [finishEmbed],
      components: []
    });
  }
}
