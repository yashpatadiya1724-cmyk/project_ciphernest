const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ciphernest';
    console.log(`🔌 Attempting MongoDB connection to: ${uri}`);
    const conn = await mongoose.connect(uri);
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);

    mongoose.connection.on('error', err => {
      console.error('🌊 Mongoose connection error event:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('📡 Mongoose disconnected');
    });

  } catch (error) {
    console.error('❌ MongoDB initialization error:', error.message);
    console.error('👉 Make sure MongoDB is installed and running on your system!');
    process.exit(1);
  }
};

module.exports = connectDB;
