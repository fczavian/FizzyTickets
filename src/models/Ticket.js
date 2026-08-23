import mongoose from 'mongoose';

const TicketSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    index: true
  },
  channelId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  ticketNumber: {
    type: Number,
    required: true
  },
  categoryId: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  addedUsers: {
    type: [String],
    default: []
  },
  claimedBy: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['OPEN', 'CLAIMED', 'CLOSING', 'CLOSED', 'REOPENED'],
    default: 'OPEN',
    index: true
  },
  priority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
    default: 'MEDIUM'
  },
  subject: {
    type: String,
    default: 'No subject provided'
  },
  description: {
    type: String,
    default: 'No description provided'
  },
  answers: {
    type: [
      {
        question: { type: String, required: true },
        answer: { type: String, default: '' }
      }
    ],
    default: []
  },
  welcomeMessageId: {
    type: String,
    default: null
  },
  lastActivityAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  inactivityWarningSent: {
    type: Boolean,
    default: false
  },
  closedAt: {
    type: Date,
    default: null
  },
  closedBy: {
    type: String,
    default: null
  },
  closeReason: {
    type: String,
    default: null
  },
  reopenedAt: {
    type: Date,
    default: null
  },
  reopenedBy: {
    type: String,
    default: null
  },
  transcriptUrl: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

TicketSchema.index({ guildId: 1, userId: 1, status: 1 });

export const Ticket = mongoose.model('Ticket', TicketSchema);
