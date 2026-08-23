import mongoose from 'mongoose';

const QuestionSchema = new mongoose.Schema({
  label: {
    type: String,
    required: true,
    trim: true,
    maxlength: 45
  },
  placeholder: {
    type: String,
    default: '',
    trim: true,
    maxlength: 100
  },
  style: {
    type: String,
    enum: ['SHORT', 'PARAGRAPH'],
    default: 'SHORT'
  },
  required: {
    type: Boolean,
    default: true
  }
}, { _id: false });

const CategorySchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  label: {
    type: String,
    required: true,
    trim: true,
    maxlength: 45
  },
  description: {
    type: String,
    default: '',
    trim: true,
    maxlength: 100
  },
  emoji: {
    type: String,
    default: '🎫',
    trim: true
  },
  channelCategoryId: {
    type: String,
    default: null
  },
  supportRoleIds: {
    type: [String],
    default: []
  },
  namingFormat: {
    type: String,
    default: 'ticket-{counter}'
  },
  defaultPriority: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
    default: 'MEDIUM'
  },
  modalTitle: {
    type: String,
    default: 'Open Ticket'
  },
  questions: {
    type: [QuestionSchema],
    default: []
  },
  modalSubjectLabel: {
    type: String,
    default: 'Brief Subject'
  },
  modalDescriptionLabel: {
    type: String,
    default: 'Detailed Description'
  }
}, { _id: false });

const GuildConfigSchema = new mongoose.Schema({
  guildId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  ticketCounter: {
    type: Number,
    default: 0
  },
  logChannelId: {
    type: String,
    default: null
  },
  transcriptsChannelId: {
    type: String,
    default: null
  },
  supportRoleIds: {
    type: [String],
    default: []
  },
  adminRoleIds: {
    type: [String],
    default: []
  },
  ticketLimit: {
    type: Number,
    default: 3
  },
  mentionStaff: {
    type: Boolean,
    default: true
  },
  panelSettings: {
    title: {
      type: String,
      default: 'Support Ticket Center'
    },
    description: {
      type: String,
      default: 'Need assistance? Select an option or click a button below to create a support ticket.'
    },
    color: {
      type: String,
      default: '#5865F2'
    },
    mode: {
      type: String,
      enum: ['BUTTONS', 'DROPDOWN'],
      default: 'BUTTONS'
    }
  },
  categories: {
    type: [CategorySchema],
    default: []
  }
}, {
  timestamps: true
});

export const GuildConfig = mongoose.model('GuildConfig', GuildConfigSchema);
