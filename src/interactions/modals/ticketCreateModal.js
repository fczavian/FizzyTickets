import { MessageFlags } from 'discord.js';
import { GuildConfig } from '../../models/GuildConfig.js';
import { ticketService } from '../../services/ticketService.js';
import { embeds } from '../../utils/embedBuilder.js';

export async function handleTicketCreateModal(interaction) {
  const categoryId = interaction.customId.replace('ticket_modal_', '');
  const guildConfig = await GuildConfig.findOne({ guildId: interaction.guild.id }).lean();
  const category = guildConfig?.categories?.find((c) => c.id === categoryId);

  const answers = [];
  let subject = 'Support Request';
  let description = 'No description provided';

  if (category?.questions && category.questions.length > 0) {
    category.questions.forEach((q, idx) => {
      let val = '';
      try {
        val = interaction.fields.getTextInputValue(`ticket_q_${idx}`) || '';
      } catch {
        val = '';
      }
      if (val) {
        answers.push({ question: q.label, answer: val });
      }
    });

    if (answers.length > 0) {
      subject = answers[0]?.answer || subject;
      if (answers.length > 1) {
        description = answers.slice(1).map((a) => `${a.question}: ${a.answer}`).join('\n');
      }
    }
  } else {
    try {
      subject = interaction.fields.getTextInputValue('ticket_subject') || subject;
    } catch {}
    try {
      description = interaction.fields.getTextInputValue('ticket_description') || description;
    } catch {}
  }

  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  try {
    const { ticket, channel } = await ticketService.createTicket({
      guild: interaction.guild,
      member: interaction.member,
      categoryId,
      subject,
      description,
      answers
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
