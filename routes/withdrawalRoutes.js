const express = require("express");
const mongoose = require("mongoose");

const Wallet = require("../models/Wallet");
const Withdrawal = require("../models/Withdrawal");
const Transaction = require("../models/Transaction");

const router = express.Router();

/* =========================
   CREATE WITHDRAWAL
========================= */

router.post("/", async (req, res) => {
  try {
    const { userId, amount, upiId } = req.body;

    if (
      !userId ||
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
      numericAmount < 100
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Minimum withdrawal amount is ₹100.",
      });
    }

    const cleanUpiId =
      String(upiId || "").trim();

    const upiPattern =
      /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z0-9.-]{2,64}$/;

    if (
      !cleanUpiId ||
      !upiPattern.test(cleanUpiId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid UPI ID.",
      });
    }

    const wallet = await Wallet.findOne({
      userId,
    });

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: "Wallet not found",
      });
    }

    /* PENDING WITHDRAWALS */

    const pendingResult =
      await Withdrawal.aggregate([
        {
          $match: {
            userId:
              new mongoose.Types.ObjectId(
                userId
              ),
            status: "Pending",
          },
        },
        {
          $group: {
            _id: null,
            total: {
              $sum: "$amount",
            },
          },
        },
      ]);

    const pendingAmount =
      Number(
        pendingResult[0]?.total || 0
      );

    const availableBalance =
      Number(wallet.balance || 0) -
      pendingAmount;

    if (numericAmount > availableBalance) {
      return res.status(400).json({
        success: false,

        message:
          `Insufficient available balance. You can withdraw ₹${Math.max(
            availableBalance,
            0
          ).toLocaleString("en-IN")}.`,
      });
    }

    const withdrawal =
      await Withdrawal.create({
        userId,
        amount: numericAmount,
        upiId: cleanUpiId,
        status: "Pending",
      });

    return res.status(201).json({
      success: true,

      message:
        "Withdrawal request submitted successfully.",

      withdrawal: {
        id: withdrawal._id,
        userId: withdrawal.userId,
        amount: withdrawal.amount,
        upiId: withdrawal.upiId,
        status: withdrawal.status,
        createdAt: withdrawal.createdAt,
      },

      wallet: {
        balance:
          Number(wallet.balance || 0),

        pendingWithdrawal:
          pendingAmount + numericAmount,

        availableBalance:
          availableBalance - numericAmount,
      },
    });
  } catch (error) {
    console.error(
      "Create withdrawal error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

/* =========================
   USER WITHDRAWAL HISTORY
========================= */

router.get(
  "/user/:userId",
  async (req, res) => {
    try {
      const { userId } = req.params;

      if (
        !mongoose.Types.ObjectId.isValid(
          userId
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID",
        });
      }

      const withdrawals =
        await Withdrawal.find({
          userId,
        })
          .sort({
            createdAt: -1,
          })
          .lean();

      return res.json({
        success: true,

        withdrawals:
          withdrawals.map(
            (withdrawal) => ({
              id: withdrawal._id,
              userId: withdrawal.userId,
              amount: withdrawal.amount,
              upiId: withdrawal.upiId,
              status: withdrawal.status,
              createdAt:
                withdrawal.createdAt,
              processedAt:
                withdrawal.processedAt,
            })
          ),
      });
    } catch (error) {
      console.error(
        "Withdrawal history error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Server error",
      });
    }
  }
);

/* =========================
   ADMIN - ALL WITHDRAWALS
========================= */

router.get(
  "/admin/all",
  async (req, res) => {
    try {
      const withdrawals =
        await Withdrawal.find()
          .populate(
            "userId",
            "name mobile email"
          )
          .sort({
            createdAt: -1,
          })
          .lean();

      return res.json({
        success: true,

        withdrawals:
          withdrawals.map(
            (withdrawal) => ({
              id: withdrawal._id,

              userId:
                withdrawal.userId?._id ||
                withdrawal.userId,

              user: withdrawal.userId
                ? {
                    id:
                      withdrawal.userId
                        ._id,

                    name:
                      withdrawal.userId
                        .name || "",

                    mobile:
                      withdrawal.userId
                        .mobile || "",

                    email:
                      withdrawal.userId
                        .email || "",
                  }
                : null,

              amount:
                withdrawal.amount,

              upiId:
                withdrawal.upiId,

              status:
                withdrawal.status,

              createdAt:
                withdrawal.createdAt,

              processedAt:
                withdrawal.processedAt,
            })
          ),
      });
    } catch (error) {
      console.error(
        "Admin withdrawal list error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load withdrawals.",
      });
    }
  }
);

/* =========================
   ADMIN - ONE WITHDRAWAL
========================= */

router.get(
  "/admin/:withdrawalId",
  async (req, res) => {
    try {
      const { withdrawalId } =
        req.params;

      if (
        !mongoose.Types.ObjectId.isValid(
          withdrawalId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid withdrawal ID",
        });
      }

      const withdrawal =
        await Withdrawal.findById(
          withdrawalId
        )
          .populate(
            "userId",
            "name mobile email"
          )
          .lean();

      if (!withdrawal) {
        return res.status(404).json({
          success: false,
          message:
            "Withdrawal not found.",
        });
      }

      return res.json({
        success: true,

        withdrawal: {
          id: withdrawal._id,

          userId:
            withdrawal.userId?._id ||
            withdrawal.userId,

          user: withdrawal.userId
            ? {
                id:
                  withdrawal.userId._id,

                name:
                  withdrawal.userId
                    .name || "",

                mobile:
                  withdrawal.userId
                    .mobile || "",

                email:
                  withdrawal.userId
                    .email || "",
              }
            : null,

          amount:
            withdrawal.amount,

          upiId:
            withdrawal.upiId,

          status:
            withdrawal.status,

          createdAt:
            withdrawal.createdAt,

          processedAt:
            withdrawal.processedAt,
        },
      });
    } catch (error) {
      console.error(
        "Admin withdrawal details error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load withdrawal.",
      });
    }
  }
);

/* =========================
   ADMIN - APPROVE
========================= */

router.patch(
  "/admin/:withdrawalId/approve",
  async (req, res) => {
    try {
      const { withdrawalId } =
        req.params;

      if (
        !mongoose.Types.ObjectId.isValid(
          withdrawalId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid withdrawal ID",
        });
      }

      const withdrawal =
        await Withdrawal.findById(
          withdrawalId
        );

      if (!withdrawal) {
        return res.status(404).json({
          success: false,
          message:
            "Withdrawal not found.",
        });
      }

      /*
        IMPORTANT:
        Same withdrawal dobara
        approve nahi hona chahiye.
      */

      if (
        withdrawal.status !== "Pending"
      ) {
        return res.status(400).json({
          success: false,
          message:
            `Withdrawal is already ${withdrawal.status}.`,
        });
      }

      const wallet =
        await Wallet.findOne({
          userId: withdrawal.userId,
        });

      if (!wallet) {
        return res.status(404).json({
          success: false,
          message:
            "User wallet not found.",
        });
      }

      const withdrawalAmount =
        Number(withdrawal.amount);

      const currentBalance =
        Number(wallet.balance || 0);

      /*
        Final balance check.

        Request banne ke baad bhi
        wallet situation change ho
        sakti hai.
      */

      if (
        currentBalance <
        withdrawalAmount
      ) {
        return res.status(400).json({
          success: false,
          message:
            "User has insufficient wallet balance.",
        });
      }

      /* =====================
         DEDUCT WALLET
      ===================== */

      wallet.balance =
        currentBalance -
        withdrawalAmount;

      wallet.totalWithdrawn =
        Number(
          wallet.totalWithdrawn || 0
        ) + withdrawalAmount;

      await wallet.save();

      /* =====================
         UPDATE WITHDRAWAL
      ===================== */

      withdrawal.status =
        "Approved";

      withdrawal.processedAt =
        new Date();

      await withdrawal.save();

      /* =====================
         TRANSACTION
      ===================== */

      await Transaction.create({
        userId:
          withdrawal.userId,

        title:
          "Withdrawal",

        description:
          `Withdrawal approved to ${withdrawal.upiId}`,

        type: "debit",

        amount:
          withdrawalAmount,

        category:
          "withdrawal",

        status:
          "Completed",

        referenceId:
          String(
            withdrawal._id
          ),
      });

      return res.json({
        success: true,

        message:
          "Withdrawal approved successfully.",

        withdrawal: {
          id:
            withdrawal._id,

          amount:
            withdrawal.amount,

          upiId:
            withdrawal.upiId,

          status:
            withdrawal.status,

          processedAt:
            withdrawal.processedAt,
        },

        wallet: {
          balance:
            wallet.balance,

          totalWithdrawn:
            wallet.totalWithdrawn,
        },
      });
    } catch (error) {
      console.error(
        "Approve withdrawal error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to approve withdrawal.",
      });
    }
  }
);

/* =========================
   ADMIN - REJECT
========================= */

router.patch(
  "/admin/:withdrawalId/reject",
  async (req, res) => {
    try {
      const { withdrawalId } =
        req.params;

      if (
        !mongoose.Types.ObjectId.isValid(
          withdrawalId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid withdrawal ID",
        });
      }

      const withdrawal =
        await Withdrawal.findById(
          withdrawalId
        );

      if (!withdrawal) {
        return res.status(404).json({
          success: false,
          message:
            "Withdrawal not found.",
        });
      }

      if (
        withdrawal.status !== "Pending"
      ) {
        return res.status(400).json({
          success: false,

          message:
            `Withdrawal is already ${withdrawal.status}.`,
        });
      }

      /*
        REJECT par wallet se
        koi balance deduct nahi hoga.
      */

      withdrawal.status =
        "Rejected";

      withdrawal.processedAt =
        new Date();

      await withdrawal.save();

      return res.json({
        success: true,

        message:
          "Withdrawal rejected successfully.",

        withdrawal: {
          id:
            withdrawal._id,

          amount:
            withdrawal.amount,

          upiId:
            withdrawal.upiId,

          status:
            withdrawal.status,

          processedAt:
            withdrawal.processedAt,
        },
      });
    } catch (error) {
      console.error(
        "Reject withdrawal error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Unable to reject withdrawal.",
      });
    }
  }
);


module.exports = router;