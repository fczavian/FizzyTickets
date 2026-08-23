import mongoose from 'mongoose';

const TicketPanelSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    index: true
  },
  channelId: {
    type: String,
    required: true
  },
  messageId: {
    type: String,
    required: true,
    unique: true
  },
  title: {
    type: String,
    default: 'Support Ticket System'
  },
  description: {
    type: String,
    default: 'Select a category below to create a support ticket.'
  },
  categoryIds: {
    type: [String],
    default: []
  },
  placeholder: {
    type: String,
    default: 'Choose a ticket category...'
  }
}, {
  timestamps: true
});

export const TicketPanel = mongoose.model('TicketPanel', TicketPanelSchema);
