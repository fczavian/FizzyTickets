import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { Ticket } from '../../models/Ticket.js';
import { embeds } from '../../utils/embedBuilder.js';
import { isTicketStaff } from '../../utils/permissionChecker.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ticket-stats')
    .setDescription('View server ticket statistics and performance metrics'),

  async execute(interaction) {
    const isStaff = await isTicketStaff(interaction.member);
    if (!isStaff) {
      return interaction.reply({
        embeds: [embeds.error('Permission Denied', 'Only support staff can view ticket statistics.')],
        flags: [MessageFlags.Ephemeral]
      });
    }

    await interaction.deferReply();

    const guildId = interaction.guild.id;

    const [
      totalCount,
      openCount,
      claimedCount,
      closedCount,
      closedTickets
    ] = await Promise.all([
      Ticket.countDocuments({ guildId }),
      Ticket.countDocuments({ guildId, status: 'OPEN' }),
      Ticket.countDocuments({ guildId, status: 'CLAIMED' }),
      Ticket.countDocuments({ guildId, status: 'CLOSED' }),
      Ticket.find({ guildId, status: 'CLOSED', closedAt: { $ne: null } }).select('createdAt closedAt claimedBy closedBy categoryId').lean()
    ]);

    // Calculate Average Resolution Time
    let avgResolutionMinutes = 0;
    if (closedTickets.length > 0) {
      const totalDurationMs = closedTickets.reduce((acc, t) => {
        const duration = new Date(t.closedAt).getTime() - new Date(t.createdAt).getTime();
        return acc + Math.max(0, duration);
      }, 0);
      avgResolutionMinutes = Math.round(totalDurationMs / (closedTickets.length * 60 * 1000));
    }

    const avgResolutionHours = (avgResolutionMinutes / 60).toFixed(1);

    // Top staff handlers
    const staffResolutionCount = {};
    for (const t of closedTickets) {
      const staffId = t.claimedBy || t.closedBy;
      if (staffId) {
        staffResolutionCount[staffId] = (staffResolutionCount[staffId] || 0) + 1;
      }
    }

    const sortedStaff = Object.entries(staffResolutionCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topStaffText = sortedStaff.length > 0
      ? sortedStaff.map(([id, count], idx) => `${idx + 1}. <@${id}>: **${count} tickets**`).join('\n')
      : 'No ticket resolution data yet';

    // Category breakdown
    const categoryStats = {};
    const allTickets = await Ticket.find({ guildId }).select('categoryId').lean();
    for (const t of allTickets) {
      categoryStats[t.categoryId] = (categoryStats[t.categoryId] || 0) + 1;
    }

    const categoryText = Object.entries(categoryStats).length > 0
      ? Object.entries(categoryStats).map(([cat, count]) => `• \`${cat}\`: **${count}**`).join('\n')
      : 'No category data';

    const statsEmbed = embeds.primary(
      `📊 Ticket Analytics | ${interaction.guild.name}`,
      `Overview of ticket system activity and staff performance.`
    )
      .addFields(
        { name: '📁 Total Tickets', value: `${totalCount}`, inline: true },
        { name: '🟢 Open Tickets', value: `${openCount}`, inline: true },
        { name: '🙋 Claimed Tickets', value: `${claimedCount}`, inline: true },
        { name: '🔒 Closed Tickets', value: `${closedCount}`, inline: true },
        { name: '⏱️ Avg Resolution Time', value: `${avgResolutionHours} hours (${avgResolutionMinutes} mins)`, inline: true },
        { name: '🏷️ By Category', value: categoryText, inline: false },
        { name: '🏆 Top Resolvers', value: topStaffText, inline: false }
      );

    await interaction.editReply({ embeds: [statsEmbed] });
  }
};
