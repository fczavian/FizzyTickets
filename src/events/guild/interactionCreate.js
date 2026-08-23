import { handleTicketDropdown } from '../../interactions/selects/ticketDropdown.js';
import { handleTicketCreateModal } from '../../interactions/modals/ticketCreateModal.js';
import { handleTicketCloseModal } from '../../interactions/modals/ticketCloseModal.js';
import {
  handleTicketCloseButton,
  handleTicketCloseConfirm,
  handleTicketCloseCancel,
  handleTicketCloseReasonPrompt
} from '../../interactions/buttons/ticketClose.js';
import {
  handleTicketClaimButton,
  handleTicketUnclaimButton
} from '../../interactions/buttons/ticketClaim.js';
import {
  handleTicketPriorityButton,
  handleTicketSetPriority
} from '../../interactions/buttons/ticketPriority.js';
import {
  handleTicketManageUsersButton,
  handleTicketAddUserSelect,
  handleTicketRemoveUserSelect
} from '../../interactions/buttons/ticketManageUsers.js';
import { handleTicketReopenButton } from '../../interactions/buttons/ticketReopen.js';
import { handleTicketDeleteButton } from '../../interactions/buttons/ticketDelete.js';
import { handleTicketTranscriptButton } from '../../interactions/buttons/ticketTranscript.js';
import { handleWizardButton } from '../../interactions/buttons/wizardButtons.js';
import { handleWizardModal } from '../../interactions/modals/wizardModals.js';
import { handleWizardSelect } from '../../interactions/selects/wizardSelects.js';
import { GuildConfig } from '../../models/GuildConfig.js';
import { config } from '../../config/config.js';
import { ticketService } from '../../services/ticketService.js';
import {
  Events,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} from 'discord.js';
import { embeds } from '../../utils/embedBuilder.js';
import { logger } from '../../utils/logger.js';
import { rateLimiter } from '../../utils/rateLimiter.js';

export default {
  name: Events.InteractionCreate,
  async execute(interaction) {
    try {
      // Anti-spam debounce protection for buttons and select menus
      if ((interaction.isButton() || interaction.isStringSelectMenu()) && !interaction.customId.startsWith('wizard_')) {
        if (rateLimiter.isSpamming(interaction.user.id, 800)) {
          return await interaction.reply({
            embeds: [embeds.error('Slow Down', 'You are clicking buttons too fast. Please wait a moment.')],
            flags: [MessageFlags.Ephemeral]
          }).catch(() => {});
        }
      }

      // 1. Slash Commands
      if (interaction.isChatInputCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) {
          logger.warn(`No command matching ${interaction.commandName} was found.`);
          return;
        }

        try {
          await command.execute(interaction);
        } catch (error) {
          logger.error(`Error executing slash command /${interaction.commandName}:`, error);
          const errorEmbed = embeds.error('Command Error', 'An error occurred while executing this command.');
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ embeds: [errorEmbed], flags: [MessageFlags.Ephemeral] }).catch(() => {});
          } else {
            await interaction.reply({ embeds: [errorEmbed], flags: [MessageFlags.Ephemeral] }).catch(() => {});
          }
        }
        return;
      }

      // 2. Select Menus
      if (interaction.isStringSelectMenu() || interaction.isRoleSelectMenu() || interaction.isChannelSelectMenu() || interaction.isUserSelectMenu()) {
        const customId = interaction.customId;

        // Setup Wizard Select Menus
        if (customId.startsWith('wizard_')) {
          return await handleWizardSelect(interaction);
        }

        if (customId === 'ticket_panel_dropdown') {
          return await handleTicketDropdown(interaction);
        }

        if (customId.startsWith('ticket_set_priority_')) {
          return await handleTicketSetPriority(interaction);
        }

        if (customId.startsWith('ticket_add_user_')) {
          return await handleTicketAddUserSelect(interaction);
        }

        if (customId.startsWith('ticket_remove_user_')) {
          return await handleTicketRemoveUserSelect(interaction);
        }
      }

      // 3. Modals
      if (interaction.isModalSubmit()) {
        const customId = interaction.customId;

        // Setup Wizard Modals
        if (customId.startsWith('wizard_')) {
          return await handleWizardModal(interaction);
        }

        if (customId.startsWith('ticket_modal_')) {
          return await handleTicketCreateModal(interaction);
        }

        if (customId.startsWith('ticket_close_modal_')) {
          return await handleTicketCloseModal(interaction);
        }
      }

      // 4. Buttons
      if (interaction.isButton()) {
        const customId = interaction.customId;

        // Setup Wizard Buttons
        if (customId.startsWith('wizard_')) {
          return await handleWizardButton(interaction);
        }

        // Panel Ticket Open Button (Buttons mode)
        if (customId.startsWith('ticket_open_btn_')) {
          const selectedCategoryId = customId.replace('ticket_open_btn_', '');
          const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id }).lean();
          const category = guildConfig?.categories?.find((c) => c.id === selectedCategoryId) || {
            id: selectedCategoryId,
            label: 'Support',
            modalTitle: 'Open Support Ticket',
            modalSubjectLabel: 'Subject / Brief Summary',
            modalDescriptionLabel: 'Describe your issue'
          };

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

            return await interaction.showModal(modal);
          }

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

            return await interaction.editReply({ embeds: [successEmbed] });
          } catch (error) {
            const errorEmbed = embeds.error('Ticket Creation Failed', error.message);
            return await interaction.editReply({ embeds: [errorEmbed] });
          }
        }

        // Close flow
        if (customId.startsWith('ticket_close_confirm_')) {
          return await handleTicketCloseConfirm(interaction);
        }
        if (customId.startsWith('ticket_close_cancel_')) {
          return await handleTicketCloseCancel(interaction);
        }
        if (customId.startsWith('ticket_close_reason_')) {
          return await handleTicketCloseReasonPrompt(interaction);
        }
        if (customId.startsWith('ticket_close_')) {
          return await handleTicketCloseButton(interaction);
        }

        // Claim flow
        if (customId.startsWith('ticket_claim_')) {
          return await handleTicketClaimButton(interaction);
        }
        if (customId.startsWith('ticket_unclaim_')) {
          return await handleTicketUnclaimButton(interaction);
        }

        // Priority flow
        if (customId.startsWith('ticket_priority_btn_')) {
          return await handleTicketPriorityButton(interaction);
        }

        // Member management flow
        if (customId.startsWith('ticket_members_btn_')) {
          return await handleTicketManageUsersButton(interaction);
        }

        // Reopen flow
        if (customId.startsWith('ticket_reopen_')) {
          return await handleTicketReopenButton(interaction);
        }

        // Delete flow
        if (customId.startsWith('ticket_delete_')) {
          return await handleTicketDeleteButton(interaction);
        }

        // Transcript flow
        if (customId.startsWith('ticket_transcript_btn_')) {
          return await handleTicketTranscriptButton(interaction);
        }
      }
    } catch (err) {
      logger.error('Unhandled interaction error:', err);
    }
  }
};
