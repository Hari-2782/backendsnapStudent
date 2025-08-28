const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
  {
    noteId: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    title: { type: String, default: '' },
    content: { type: String, default: '' },
    tags: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

noteSchema.index({ userId: 1, updatedAt: -1 });
noteSchema.index({ noteId: 1 });

module.exports = mongoose.model('Note', noteSchema);
