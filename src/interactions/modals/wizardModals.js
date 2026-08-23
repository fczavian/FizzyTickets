import { GuildConfig } from '../../models/GuildConfig.js';
import { wizardService } from '../../services/wizardService.js';
import { embeds } from '../../utils/embedBuilder.js';
import { MessageFlags } from 'discord.js';

export async function handleWizardModal(interaction) {
  const customId = interaction.customId;

  let guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id });
  if (!guildConfig) {
    guildConfig = await GuildConfig.create({ guildId: interaction.guild.id });
  }

  // 1. Edit Server Settings Modal (Step 1)
  if (customId === 'wizard_edit_settings_modal') {
    const rawLimit = interaction.fields.getTextInputValue('settings_ticket_limit');
    const parsedLimit = parseInt(rawLimit, 10);

    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 20) {
      return interaction.reply({
        embeds: [embeds.error('Invalid Limit', 'Ticket limit must be a number between 1 and 20.')],
        flags: [MessageFlags.Ephemeral]
      });
    }

    guildConfig.ticketLimit = parsedLimit;
    await guildConfig.save();

    const view = wizardService.buildStep1(guildConfig);
    return await interaction.update(view);
  }

  // 2. Category Info Modal (Step 2 Category Builder)
  if (customId === 'wizard_modal_category_info') {
    const name = interaction.fields.getTextInputValue('category_name').trim();
    const emoji = interaction.fields.getTextInputValue('category_emoji').trim() || '🎫';
    const description = interaction.fields.getTextInputValue('category_description').trim() || '';

    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || `cat-${Date.now()}`;

    const draft = wizardService.getDraft(interaction.guild.id, interaction.user.id);
    if (!draft.tempCategory) {
      draft.tempCategory = { questions: [] };
    }

    draft.tempCategory.id = slug;
    draft.tempCategory.label = name;
    draft.tempCategory.emoji = emoji;
    draft.tempCategory.description = description;

    const view = wizardService.buildStep2(guildConfig, interaction.user.id);
    return await interaction.update(view);
  }

  // 2b. Question Modal (Q1 to Q5)
  if (customId.startsWith('wizard_modal_question_')) {
    const qNum = parseInt(customId.replace('wizard_modal_question_', ''), 10);
    const label = interaction.fields.getTextInputValue('q_label').trim();
    const placeholder = interaction.fields.getTextInputValue('q_placeholder').trim() || '';
    const rawStyle = interaction.fields.getTextInputValue('q_style').trim();
    const rawRequired = interaction.fields.getTextInputValue('q_required').trim();

    // Validate and normalize answer style
    let normalizedStyle = 'SHORT';
    if (/^(short|s|line|single)$/i.test(rawStyle)) {
      normalizedStyle = 'SHORT';
    } else if (/^(paragraph|para|p|long|multi)$/i.test(rawStyle)) {
      normalizedStyle = 'PARAGRAPH';
    } else {
      return interaction.reply({
        embeds: [
          embeds.error(
            'Invalid Answer Type',
            `You entered **"${rawStyle}"** for Answer Type.\n\n` +
            'Please type either **SHORT** (single-line input) or **PARAGRAPH** (multi-line input).'
          )
        ],
        flags: [MessageFlags.Ephemeral]
      });
    }

    // Validate and normalize required flag
    let isRequired = true;
    if (/^(no|n|false|0|optional)$/i.test(rawRequired)) {
      isRequired = false;
    }

    const draft = wizardService.getDraft(interaction.guild.id, interaction.user.id);
    if (!draft.tempCategory) {
      draft.tempCategory = { questions: [] };
    }
    if (!Array.isArray(draft.tempCategory.questions)) {
      draft.tempCategory.questions = [];
    }

    draft.tempCategory.questions[qNum - 1] = {
      label,
      placeholder,
      style: normalizedStyle,
      required: isRequired
    };

    // Filter out undefined holes if any
    draft.tempCategory.questions = draft.tempCategory.questions.filter((q) => q != null);

    const view = wizardService.buildStep2(guildConfig, interaction.user.id);
    return await interaction.update(view);
  }

  // 3. Edit Panel Embed Text Modal (Step 3)
  if (customId === 'wizard_edit_panel_modal') {
    const title = interaction.fields.getTextInputValue('panel_title').trim();
    const description = interaction.fields.getTextInputValue('panel_desc').trim();
    let color = interaction.fields.getTextInputValue('panel_color').trim() || '#5865F2';

    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
      color = '#5865F2';
    }

    if (!guildConfig.panelSettings) {
      guildConfig.panelSettings = {};
    }

    guildConfig.panelSettings.title = title;
    guildConfig.panelSettings.description = description;
    guildConfig.panelSettings.color = color;
    await guildConfig.save();

    const view = wizardService.buildStep3(guildConfig);
    return await interaction.update(view);
  }
}
