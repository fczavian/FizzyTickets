import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { embeds } from '../../utils/embedBuilder.js';
import { isGuildAdmin, isTicketStaff } from '../../utils/permissionChecker.js';

export default {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('View available commands and documentation'),

  async execute(interaction) {
    const isAdmin = await isGuildAdmin(interaction.member);
    const isStaff = await isTicketStaff(interaction.member);

    const embed = embeds.primary(
      'FizzyTickets | Command Guide',
      'Complete list of commands available in the server.'
    );

    embed.addFields({
      name: '🌐 General Commands',
      value:
        '`/ping` - Check bot latency and heartbeat\n' +
        '`/help` - View this help guide',
      inline: false
    });

    if (isStaff || isAdmin) {
      embed.addFields({
        name: '🛠️ Staff Commands (Inside Tickets)',
        value:
          '`/ticket claim` - Claim ticket to handle it personally\n' +
          '`/ticket unclaim` - Release claimed ticket\n' +
          '`/ticket priority <level>` - Set ticket urgency (Low, Medium, High, Urgent)\n' +
          '`/ticket add <user>` - Add a user to the ticket\n' +
          '`/ticket remove <user>` - Remove a user from the ticket\n' +
          '`/ticket rename <name>` - Rename the ticket channel\n' +
          '`/ticket close [reason]` - Close ticket and generate transcript\n' +
          '`/ticket-stats` - View server ticket statistics',
        inline: false
      });
    }

    if (isAdmin) {
      embed.addFields({
        name: '👑 Administrator Commands',
        value:
          '`/setup` - Interactive 3-step setup wizard (settings, categories, panel)\n' +
          '`/ticket-blacklist <add|remove|list>` - Manage user ticket blacklist',
        inline: false
      });
    }

    embed.setFooter({ text: 'FizzyTickets • Developed by FizzyStudio' });

    await interaction.reply({
      embeds: [embed],
      flags: [MessageFlags.Ephemeral]
    });
  }
};
