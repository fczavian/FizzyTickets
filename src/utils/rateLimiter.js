const interactionTimestamps = new Map();
const ticketCreationTimestamps = new Map();

export const rateLimiter = {
  // Checks for rapid button / select / modal spam (1 second debounce)
  isSpamming(userId, windowMs = 1000) {
    const now = Date.now();
    const lastInteraction = interactionTimestamps.get(userId) || 0;

    if (now - lastInteraction < windowMs) {
      return true;
    }

    interactionTimestamps.set(userId, now);
    return false;
  },

  // Checks ticket creation cooldown
  checkTicketCooldown(guildId, userId, cooldownSeconds = 15) {
    if (cooldownSeconds <= 0) return { onCooldown: false, secondsLeft: 0 };

    const key = `${guildId}_${userId}`;
    const now = Date.now();
    const lastCreation = ticketCreationTimestamps.get(key) || 0;
    const elapsedSeconds = (now - lastCreation) / 1000;

    if (elapsedSeconds < cooldownSeconds) {
      const secondsLeft = Math.ceil(cooldownSeconds - elapsedSeconds);
      return { onCooldown: true, secondsLeft };
    }

    return { onCooldown: false, secondsLeft: 0 };
  },

  // Record successful ticket creation
  recordTicketCreation(guildId, userId) {
    const key = `${guildId}_${userId}`;
    ticketCreationTimestamps.set(key, Date.now());
  },

  // Periodic cleanup to avoid memory leak
  cleanup() {
    const now = Date.now();
    for (const [key, timestamp] of interactionTimestamps.entries()) {
      if (now - timestamp > 60000) {
        interactionTimestamps.delete(key);
      }
    }
    for (const [key, timestamp] of ticketCreationTimestamps.entries()) {
      if (now - timestamp > 3600000) {
        ticketCreationTimestamps.delete(key);
      }
    }
  }
};

// Run garbage collection every 5 minutes
setInterval(() => rateLimiter.cleanup(), 5 * 60 * 1000);
