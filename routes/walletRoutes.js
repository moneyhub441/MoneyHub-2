const express = require("express");
const mongoose = require("mongoose");

const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");

const router = express.Router();

/* =========================================================
   ADMIN - GET ALL CUSTOMER WALLETS
   IMPORTANT:
   Ye route /:userId se UPAR rehna chahiye.
========================================================= */

router.get(
  "/admin/all",
  async (req, res) => {
    try {
      /* =========================
         LOAD ALL WALLETS
      ========================= */

      const wallets =
        await Wallet.find()
          .populate(
            "userId",
            "name mobile email"
          )
          .sort({
            createdAt: -1,
          })
          .lean();

      /* =========================
         BUILD WALLET DATA
      ========================= */

      const walletData =
        await Promise.all(
          wallets.map(
            async (wallet) => {
              /*
                userId populate hone par
                object hoga.

                Agar user delete ho gaya
                ho to null bhi ho sakta hai.
              */

              const populatedUser =
                wallet.userId &&
                typeof wallet.userId ===
                  "object"
                  ? wallet.userId
                  : null;

              const userId =
                populatedUser?._id ||
                wallet.userId;

              /* =====================
                 TRANSACTION COUNT
              ===================== */

              let transactionCount = 0;

              if (userId) {
                transactionCount =
                  await Transaction.countDocuments(
                    {
                      userId,
                    }
                  );
              }

              return {
                id: wallet._id,

                userId,

                user: populatedUser
                  ? {
                      id:
                        populatedUser._id,

                      name:
                        populatedUser.name ||
                        "",

                      mobile:
                        populatedUser.mobile ||
                        "",

                      email:
                        populatedUser.email ||
                        "",
                    }
                  : null,

                balance:
                  Number(
                    wallet.balance || 0
                  ),

                totalAdded:
                  Number(
                    wallet.totalAdded || 0
                  ),

                totalWithdrawn:
                  Number(
                    wallet.totalWithdrawn ||
                      0
                  ),

                totalIncome:
                  Number(
                    wallet.totalIncome || 0
                  ),

                transactionCount,
              };
            }
          )
        );

      /* =========================
         TOTAL WALLET BALANCE
      ========================= */

      const totalWalletBalance =
        walletData.reduce(
          (total, wallet) =>
            total +
            Number(
              wallet.balance || 0
            ),
          0
        );

      /* =========================
         ACTIVE WALLETS
      ========================= */

      const activeWallets =
        walletData.filter(
          (wallet) =>
            Number(
              wallet.balance || 0
            ) > 0 ||
            Number(
              wallet.transactionCount ||
                0
            ) > 0
        ).length;

      /* =========================
         RESPONSE
      ========================= */

      return res.json({
        success: true,

        summary: {
          totalWallets:
            walletData.length,

          activeWallets,

          totalWalletBalance,
        },

        wallets: walletData,
      });
    } catch (error) {
      console.error(
        "Admin wallets error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Unable to load customer wallets.",
        });
    }
  }
);

/* =========================================================
   GET SINGLE USER WALLET
========================================================= */
/* =========================================================
   ADMIN - CREDIT WALLET
========================================================= */

router.patch(
  "/admin/:userId/credit",
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { amount, note } = req.body;

      if (
        !mongoose.Types.ObjectId.isValid(userId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID",
        });
      }

      const numericAmount = Number(amount);

      if (
        !Number.isFinite(numericAmount) ||
        numericAmount <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid amount.",
        });
      }

      let wallet =
        await Wallet.findOne({
          userId,
        });

      if (!wallet) {
        wallet =
          await Wallet.create({
            userId,
          });
      }

      wallet.balance =
        Number(wallet.balance || 0) +
        numericAmount;

      wallet.totalAdded =
        Number(wallet.totalAdded || 0) +
        numericAmount;

      await wallet.save();

      const transaction =
        await Transaction.create({
          userId,

          title:
            "Admin Balance Added",

          description:
            String(note || "").trim() ||
            "Balance credited by admin",

          type: "credit",

          amount: numericAmount,

          category:
            "admin_credit",

          status:
            "Completed",
        });

      return res.json({
        success: true,

        message:
          "Balance added successfully.",

        wallet: {
          balance:
            Number(wallet.balance || 0),

          totalAdded:
            Number(wallet.totalAdded || 0),

          totalWithdrawn:
            Number(
              wallet.totalWithdrawn || 0
            ),

          totalIncome:
            Number(wallet.totalIncome || 0),
        },

        transaction: {
          id: transaction._id,

          title:
            transaction.title,

          description:
            transaction.description,

          type:
            transaction.type,

          amount:
            transaction.amount,

          category:
            transaction.category,

          status:
            transaction.status,

          createdAt:
            transaction.createdAt,
        },
      });
    } catch (error) {
      console.error(
        "Admin credit wallet error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to add wallet balance.",
      });
    }
  }
);

/* =========================================================
   ADMIN - DEBIT WALLET
========================================================= */

router.patch(
  "/admin/:userId/debit",
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { amount, note } = req.body;

      if (
        !mongoose.Types.ObjectId.isValid(userId)
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID",
        });
      }

      const numericAmount = Number(amount);

      if (
        !Number.isFinite(numericAmount) ||
        numericAmount <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid amount.",
        });
      }

      const wallet =
        await Wallet.findOne({
          userId,
        });

      if (!wallet) {
        return res.status(404).json({
          success: false,
          message: "Wallet not found.",
        });
      }

      const currentBalance =
        Number(wallet.balance || 0);

      if (
        numericAmount >
        currentBalance
      ) {
        return res.status(400).json({
          success: false,

          message:
            `Insufficient wallet balance. Available balance: ₹${currentBalance.toLocaleString(
              "en-IN"
            )}`,
        });
      }

      wallet.balance =
        currentBalance -
        numericAmount;

      /*
        IMPORTANT:

        Admin manual debit ko
        totalWithdrawn me add nahi karenge.

        totalWithdrawn sirf actual
        withdrawals ke liye rahega.
      */

      await wallet.save();

      const transaction =
        await Transaction.create({
          userId,

          title:
            "Admin Balance Deducted",

          description:
            String(note || "").trim() ||
            "Balance deducted by admin",

          type: "debit",

          amount:
            numericAmount,

          category:
            "admin_debit",

          status:
            "Completed",
        });

      return res.json({
        success: true,

        message:
          "Balance deducted successfully.",

        wallet: {
          balance:
            Number(wallet.balance || 0),

          totalAdded:
            Number(wallet.totalAdded || 0),

          totalWithdrawn:
            Number(
              wallet.totalWithdrawn || 0
            ),

          totalIncome:
            Number(wallet.totalIncome || 0),
        },

        transaction: {
          id:
            transaction._id,

          title:
            transaction.title,

          description:
            transaction.description,

          type:
            transaction.type,

          amount:
            transaction.amount,

          category:
            transaction.category,

          status:
            transaction.status,

          createdAt:
            transaction.createdAt,
        },
      });
    } catch (error) {
      console.error(
        "Admin debit wallet error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to deduct wallet balance.",
      });
    }
  }
);
router.get(
  "/:userId",
  async (req, res) => {
    try {
      const { userId } =
        req.params;

      /* =========================
         VALIDATE USER ID
      ========================= */

      if (
        !mongoose.Types.ObjectId.isValid(
          userId
        )
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message:
              "Invalid user ID",
          });
      }

      /* =========================
         FIND WALLET
      ========================= */

      let wallet =
        await Wallet.findOne({
          userId,
        });

      /*
        First wallet open:
        wallet automatically
        create ho jayega.
      */

      if (!wallet) {
        wallet =
          await Wallet.create({
            userId,
          });
      }

      /* =========================
         RECENT TRANSACTIONS
      ========================= */

      const transactions =
        await Transaction.find({
          userId,
        })
          .sort({
            createdAt: -1,
          })
          .limit(50)
          .lean();

      /* =========================
         RESPONSE
      ========================= */

      return res.json({
        success: true,

        wallet: {
          id:
            wallet._id,

          userId:
            wallet.userId,

          balance:
            Number(
              wallet.balance || 0
            ),

          totalAdded:
            Number(
              wallet.totalAdded || 0
            ),

          totalWithdrawn:
            Number(
              wallet.totalWithdrawn ||
                0
            ),

          totalIncome:
            Number(
              wallet.totalIncome || 0
            ),
        },

        transactions:
          transactions.map(
            (transaction) => ({
              id:
                transaction._id,

              title:
                transaction.title,

              description:
                transaction.description,

              type:
                transaction.type,

              amount:
                Number(
                  transaction.amount ||
                    0
                ),

              category:
                transaction.category,

              status:
                transaction.status,

              referenceId:
                transaction.referenceId,

              createdAt:
                transaction.createdAt,
            })
          ),
      });
    } catch (error) {
      console.error(
        "Get wallet error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Unable to load wallet",
        });
    }
  }
);

module.exports = router;