const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    // Don't exit — run in demo mode without DB
    console.log('⚠️  Running in DEMO MODE (no database)');
    return false;
  }
  return true;
};

module.exports = connectDB;
