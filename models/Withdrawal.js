const mongoose = require("mongoose");

const withdrawalSchema =
  new mongoose.Schema(
    {
      /* =========================
         USER
      ========================= */

      userId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "User",

        required: true,

        index: true,
      },

      /* =========================
         AMOUNT
      ========================= */

      amount: {
        type: Number,

        required: true,

        min: 100,
      },

      /* =========================
         UPI
      ========================= */

      upiId: {
        type: String,

        required: true,

        trim: true,
      },

      /* =========================
         STATUS
      ========================= */

      status: {
        type: String,

        enum: [
          "Pending",
          "Approved",
          "Rejected",
        ],

        default: "Pending",

        index: true,
      },

      /* =========================
         ADMIN NOTE
      ========================= */

      adminNote: {
        type: String,

        default: "",

        trim: true,
      },

      /* =========================
         PROCESS INFORMATION
      ========================= */

      processedAt: {
        type: Date,

        default: null,
      },

      processedBy: {
        type: String,

        default: "",
      },

      /* =========================
         PAYMENT / UTR
      ========================= */

      payoutReference: {
        type: String,

        default: "",

        trim: true,
      },
    },
    {
      timestamps: true,
    }
  );

/* =========================
   INDEX
========================= */

withdrawalSchema.index({
  userId: 1,
  createdAt: -1,
});

/* =========================
   MODEL
========================= */

const Withdrawal =
  mongoose.model(
    "Withdrawal",
    withdrawalSchema
  );

module.exports = Withdrawal;