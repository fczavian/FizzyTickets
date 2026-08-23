import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags
} from 'discord.js';
import { GuildConfig } from '../../models/GuildConfig.js';
import { config } from '../../config/config.js';
import { ticketService } from '../../services/ticketService.js';
import { embeds } from '../../utils/embedBuilder.js';

export async function handleTicketDropdown(interaction) {
  const selectedCategoryId = interaction.values[0];
  if (!selectedCategoryId) return;

  const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id }).lean();
  const category = guildConfig?.categories?.find((c) => c.id === selectedCategoryId) || {
    id: selectedCategoryId,
    label: 'Support',
    modalTitle: 'Open Support Ticket',
    modalSubjectLabel: 'Subject / Issue Title',
    modalDescriptionLabel: 'Describe your issue'
  };

  // If modals are enabled, present the modal form
  if (config.features.modals.enabled) {
    const modal = new ModalBuilder()
      .setCustomId(`ticket_modal_${selectedCategoryId}`)
      .setTitle((category.modalTitle || 'Open Ticket').substring(0, 45));

    if (category.questions && category.questions.length > 0) {
      category.questions.slice(0, 5).forEach((q, idx) => {
        const input = new TextInputBuilder()
          .setCustomId(`ticket_q_${idx}`)
          .setLabel(q.label.substring(0, 45))
          .setStyle(q.style === 'PARAGRAPH' ? TextInputStyle.Paragraph : TextInputStyle.Short)
          .setRequired(q.required !== false)
          .setMaxLength(q.style === 'PARAGRAPH' ? 1000 : 100);

        if (q.placeholder) {
          input.setPlaceholder(q.placeholder.substring(0, 100));
        }

        modal.addComponents(new ActionRowBuilder().addComponents(input));
      });
    } else {
      const subjectInput = new TextInputBuilder()
        .setCustomId('ticket_subject')
        .setLabel(category.modalSubjectLabel || 'Subject')
        .setPlaceholder('Briefly summarize your request')
        .setStyle(TextInputStyle.Short)
        .setRequired(config.features.modals.requireSubject)
        .setMaxLength(100);

      const descriptionInput = new TextInputBuilder()
        .setCustomId('ticket_description')
        .setLabel(category.modalDescriptionLabel || 'Description')
        .setPlaceholder('Provide all details, error messages, or context')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(config.features.modals.requireDescription)
        .setMaxLength(1000);

      modal.addComponents(
        new ActionRowBuilder().addComponents(subjectInput),
        new ActionRowBuilder().addComponents(descriptionInput)
      );
    }

    await interaction.showModal(modal);
    return;
  }

  // If modals are disabled, create the channel directly
  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  try {
    const { ticket, channel } = await ticketService.createTicket({
      guild: interaction.guild,
      member: interaction.member,
      categoryId: selectedCategoryId,
      subject: 'Support Request',
      description: 'No description provided'
    });

    const successEmbed = embeds.success(
      'Ticket Created',
      `Your ticket has been opened in <#${channel.id}>.`
    );

    await interaction.editReply({ embeds: [successEmbed] });
  } catch (error) {
    const errorEmbed = embeds.error('Ticket Creation Failed', error.message);
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
