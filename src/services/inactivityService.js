import { CronJob } from 'cron';
import { Ticket } from '../models/Ticket.js';
import { config } from '../config/config.js';
import { embeds } from '../utils/embedBuilder.js';
import { ticketService } from './ticketService.js';
import { logger } from '../utils/logger.js';

let cronJob = null;

export function startInactivityMonitor(client) {
  if (!config.features.inactivity.enabled) {
    logger.info('Inactivity monitor is disabled in config.yml.');
    return;
  }

  const intervalMinutes = config.features.inactivity.checkIntervalMinutes || 10;
  const cronPattern = `*/${intervalMinutes} * * * *`;

  logger.info(`Starting inactivity monitor cron (${cronPattern})...`);

  cronJob = new CronJob(cronPattern, async () => {
    try {
      await processInactiveTickets(client);
    } catch (error) {
      logger.error('Error during inactivity check run:', error);
    }
  });

  cronJob.start();
}

export function stopInactivityMonitor() {
  if (cronJob) {
    cronJob.stop();
    logger.info('Inactivity monitor stopped.');
  }
}

async function processInactiveTickets(client) {
  const warningHours = config.features.inactivity.warningHours || 24;
  const autoCloseHours = config.features.inactivity.autoCloseHours || 48;

  const warningThreshold = new Date(Date.now() - warningHours * 60 * 60 * 1000);
  const closeThreshold = new Date(Date.now() - autoCloseHours * 60 * 60 * 1000);

  // 1. Process tickets ready for auto-closure
  const ticketsToClose = await Ticket.find({
    status: { $in: ['OPEN', 'CLAIMED', 'REOPENED'] },
    lastActivityAt: { $lte: closeThreshold }
  });

  for (const ticket of ticketsToClose) {
    try {
      const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
      if (!channel) {
        // Channel was deleted externally, mark closed
        ticket.status = 'CLOSED';
        ticket.closedAt = new Date();
        ticket.closeReason = 'Channel deleted or inaccessible';
        await ticket.save();
        continue;
      }

      await ticketService.closeTicket({
        ticket,
        channel,
        closedByUser: client.user,
        reason: `Auto-closed after ${autoCloseHours} hours of inactivity`
      });

      logger.info(`Auto-closed inactive ticket #${ticket.ticketNumber} (${ticket.channelId})`);
    } catch (error) {
      logger.error(`Failed to auto-close inactive ticket ${ticket.channelId}:`, error);
    }
  }

  // 2. Process tickets needing inactivity warning
  const ticketsToWarn = await Ticket.find({
    status: { $in: ['OPEN', 'CLAIMED', 'REOPENED'] },
    inactivityWarningSent: false,
    lastActivityAt: { $lte: warningThreshold, $gt: closeThreshold }
  });

  for (const ticket of ticketsToWarn) {
    try {
      const channel = await client.channels.fetch(ticket.channelId).catch(() => null);
      if (!channel) continue;

      const remainingHours = Math.max(1, autoCloseHours - warningHours);
      const warningEmbed = embeds.warning(
        'Inactivity Notice',
        `Hello <@${ticket.userId}>, this ticket has had no activity for **${warningHours} hours**.\n` +
        `If no response is received, this ticket will automatically close in **${remainingHours} hours**.`
      );

      await channel.send({
        content: `<@${ticket.userId}>`,
        embeds: [warningEmbed]
      });

      ticket.inactivityWarningSent = true;
      await ticket.save();

      logger.info(`Sent inactivity reminder for ticket #${ticket.ticketNumber} (${ticket.channelId})`);
    } catch (error) {
      logger.error(`Failed to send inactivity warning for ticket ${ticket.channelId}:`, error);
    }
  }
}
