import { SlashCommandBuilder } from 'discord.js';
import { embeds } from '../../utils/embedBuilder.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check bot latency and gateway connection'),

  async execute(interaction) {
    const sent = await interaction.reply({
      content: 'Pinging...',
      fetchReply: true
    });

    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
    const wsLatency = interaction.client.ws.ping;

    const embed = embeds.primary(
      '🏓 Pong!',
      `**Roundtrip Latency:** ${roundtrip}ms\n` +
      `**Websocket Heartbeat:** ${wsLatency}ms`
    );

    await interaction.editReply({
      content: null,
      embeds: [embed]
    });
  }
};
