const mongoose = require("mongoose");

const transactionSchema =
  new mongoose.Schema(
    {
      userId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "User",

        required: true,

        index: true,
      },

      title: {
        type: String,
        required: true,
        trim: true,
      },

      description: {
        type: String,
        default: "",
        trim: true,
      },

      type: {
        type: String,

        enum: [
          "credit",
          "debit",
        ],

        required: true,
      },

      amount: {
        type: Number,
        required: true,
        min: 0,
      },

      category: {
        type: String,

        enum: [
          "add_balance",
          "withdrawal",
          "purchase",
          "income",
          "refund",
          "admin",
          "other",
        ],

        default: "other",
      },

      status: {
        type: String,

        enum: [
          "Pending",
          "Completed",
          "Rejected",
          "Failed",
        ],

        default: "Completed",
      },

      referenceId: {
        type: String,
        default: "",
      },
    },
    {
      timestamps: true,
    }
  );

module.exports =
  mongoose.model(
    "Transaction",
    transactionSchema
  );