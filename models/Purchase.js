const mongoose = require("mongoose");

const purchaseSchema =
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
         PRODUCT
      ========================= */

      productId: {
        type:
          mongoose.Schema.Types.ObjectId,

        ref: "Product",

        default: null,
      },


      productName: {
        type: String,

        required: true,

        trim: true,
      },


      productImage: {
        type: String,

        default: "",
      },


      /* =========================
         PURCHASE PRICE
      ========================= */

      price: {
        type: Number,

        required: true,

        min: 0,
      },


      /* =========================
         INCOME PLAN
      ========================= */

      dailyIncome: {
        type: Number,

        required: true,

        min: 0,
      },


      totalIncome: {
        type: Number,

        required: true,

        min: 0,
      },


      duration: {
        type: Number,

        required: true,

        min: 1,
      },


      /* =========================
         INCOME PROGRESS
      ========================= */

      earnedIncome: {
        type: Number,

        default: 0,

        min: 0,
      },


      creditedDays: {
        type: Number,

        default: 0,

        min: 0,
      },


      lastIncomeAt: {
        type: Date,

        default: null,
      },


      /* =========================
         STATUS
      ========================= */

      status: {
        type: String,

        enum: [
          "Active",
          "Completed",
          "Cancelled",
        ],

        default: "Active",

        index: true,
      },


      /* =========================
         PURCHASE DATE
      ========================= */

      purchasedAt: {
        type: Date,

        default: Date.now,
      },
    },

    {
      timestamps: true,
    }
  );


/* =========================
   INDEX
========================= */

purchaseSchema.index({
  userId: 1,
  createdAt: -1,
});


/* =========================
   MODEL
========================= */

const Purchase =
  mongoose.model(
    "Purchase",
    purchaseSchema
  );


module.exports = Purchase;