const mongoose = require("mongoose");

const walletSchema =
  new mongoose.Schema(
    {
      userId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "User",

        required: true,

        unique: true,

        index: true,
      },

      balance: {
        type: Number,
        default: 0,
        min: 0,
      },

      totalAdded: {
        type: Number,
        default: 0,
        min: 0,
      },

      totalWithdrawn: {
        type: Number,
        default: 0,
        min: 0,
      },

      totalIncome: {
        type: Number,
        default: 0,
        min: 0,
      },
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    "Wallet",
    walletSchema
  );