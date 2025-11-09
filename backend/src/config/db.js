const mongoose = require('mongoose');

const connectDB = async (mongoUri) => {
  try {
    await mongoose.connect(mongoUri);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('Mongo connection error', error.message);
    process.exit(1);
  }
};

module.exports = connectDB;
