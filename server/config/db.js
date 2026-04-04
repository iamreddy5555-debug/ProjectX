const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      family: 4, // Force IPv4 to prevent Windows DNS/IPv6 routing errors
      serverSelectionTimeoutMS: 10000
    });
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
