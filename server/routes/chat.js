const express = require('express');
const ChatMessage = require('../models/ChatMessage');
const { auth } = require('../middleware/auth');
const router = express.Router();

// Get chat history for current user
router.get('/', auth, async (req, res) => {
  try {
    const messages = await ChatMessage.find({
      $or: [
        { senderId: req.user.id },
        { receiverId: req.user.id }
      ]
    }).sort({ createdAt: 1 }).limit(100);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Send a message
router.post('/', auth, async (req, res) => {
  try {
    const { message, receiverId } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ message: 'Message is required' });
    }
    const chatMessage = new ChatMessage({
      senderId: req.user.id,
      receiverId: receiverId || null,
      message: message.trim(),
      senderRole: req.user.role,
    });
    await chatMessage.save();
    res.status(201).json(chatMessage);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
