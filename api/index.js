const app = require("../server");
const mongoose = require("mongoose");

module.exports = async (req, res) => {
  try {

    if (mongoose.connection.readyState !== 1) {
      await mongoose.connect(
        process.env.MONGO_URI,
        {
          serverSelectionTimeoutMS: 30000,
        }
      );
    }

    return app(req, res);

  } catch (error) {

    console.error(
      "Mongo connection error:",
      error.message
    );

    return res.status(500).json({
      success:false,
      message:"Database connection failed",
    });

  }
};