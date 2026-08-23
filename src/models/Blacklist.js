import mongoose from 'mongoose';

const BlacklistSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  reason: {
    type: String,
    default: 'No reason provided'
  },
  addedBy: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

BlacklistSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const Blacklist = mongoose.model('Blacklist', BlacklistSchema);
