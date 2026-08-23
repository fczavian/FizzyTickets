import { MessageFlags } from 'discord.js';
import { transcriptService } from '../../services/transcriptService.js';
import { embeds } from '../../utils/embedBuilder.js';
import { config } from '../../config/config.js';

export async function handleTicketTranscriptButton(interaction) {
  if (!config.features.transcripts.enabled) {
    return interaction.reply({
      embeds: [embeds.error('Feature Disabled', 'Transcripts are currently disabled in settings.')],
      flags: [MessageFlags.Ephemeral]
    });
  }

  await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

  try {
    const attachment = await transcriptService.generateTranscript(interaction.channel);
    if (!attachment) {
      return interaction.editReply({
        embeds: [embeds.error('Transcript Error', 'Could not generate HTML transcript.')]
      });
    }

    const embed = embeds.success(
      'HTML Transcript Generated',
      'Download your interactive transcript file below.'
    );

    await interaction.editReply({
      embeds: [embed],
      files: [attachment]
    });
  } catch (error) {
    await interaction.editReply({
      embeds: [embeds.error('Transcript Failed', error.message)]
    });
  }
}
