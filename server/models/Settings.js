import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    unique: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  }
}, {
  timestamps: true
});

export default mongoose.model('Settings', settingsSchema);