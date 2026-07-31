const express = require("express");
const mongoose = require("mongoose");

const Purchase = require("../models/Purchase");
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");

const router = express.Router();

/* =========================
   CONSTANTS
========================= */

const ONE_DAY =
  24 * 60 * 60 * 1000;

/* =========================
   CREATE PURCHASE
========================= */

router.post("/", async (req, res) => {
  try {
    const {
      userId,
      productId,
      productName,
      productImage,
      price,
      dailyIncome,
      totalIncome,
      duration,
    } = req.body;

    /* =====================
       USER CHECK
    ===================== */

    if (
      !userId ||
      !mongoose.Types.ObjectId.isValid(userId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    /* =====================
       PRODUCT VALUES
    ===================== */

    const numericPrice =
      Number(price);

    const numericDailyIncome =
      Number(dailyIncome);

    const numericTotalIncome =
      Number(totalIncome);

    const numericDuration =
      Number(duration);

    /* =====================
       PRODUCT NAME
    ===================== */

    if (!productName?.trim()) {
      return res.status(400).json({
        success: false,
        message:
          "Product name is required.",
      });
    }

    /* =====================
       PRICE CHECK
    ===================== */

    if (
      !Number.isFinite(numericPrice) ||
      numericPrice <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid product price.",
      });
    }

    /* =====================
       INCOME PLAN CHECK
    ===================== */

    if (
      !Number.isFinite(
        numericDailyIncome
      ) ||
      numericDailyIncome <= 0 ||
      !Number.isFinite(
        numericTotalIncome
      ) ||
      numericTotalIncome <= 0 ||
      !Number.isFinite(
        numericDuration
      ) ||
      numericDuration <= 0
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid product income plan.",
      });
    }

    /* =====================
       FIND WALLET
    ===================== */

    const wallet =
      await Wallet.findOne({
        userId,
      });

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message:
          "Wallet not found.",
      });
    }

    /* =====================
       BALANCE CHECK
    ===================== */

    const currentBalance =
      Number(
        wallet.balance || 0
      );

    if (
      currentBalance <
      numericPrice
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Insufficient wallet balance.",
      });
    }

    /* =====================
       DEDUCT BALANCE
    ===================== */

    wallet.balance =
      currentBalance -
      numericPrice;

    await wallet.save();

    /* =====================
       CREATE PURCHASE
    ===================== */

    const purchase =
      await Purchase.create({
        userId,

        productId:
          productId &&
          mongoose.Types.ObjectId.isValid(
            productId
          )
            ? productId
            : null,

        productName:
          productName.trim(),

        productImage:
          productImage || "",

        price:
          numericPrice,

        dailyIncome:
          numericDailyIncome,

        totalIncome:
          numericTotalIncome,

        duration:
          numericDuration,

        earnedIncome: 0,

        creditedDays: 0,

        status: "Active",

        purchasedAt:
          new Date(),

        lastIncomeAt: null,
      });

    /* =====================
       PURCHASE TRANSACTION
    ===================== */

    await Transaction.create({
      userId,

      title:
        "Product Purchase",

      description:
        `${productName.trim()} purchased`,

      type:
        "debit",

      amount:
        numericPrice,

      category:
        "purchase",

      status:
        "Completed",

      referenceId:
        String(
          purchase._id
        ),
    });

    /* =====================
       RESPONSE
    ===================== */

    return res
      .status(201)
      .json({
        success: true,

        message:
          "Product purchased successfully.",

        purchase,

        wallet: {
          balance:
            Number(
              wallet.balance || 0
            ),
        },
      });
  } catch (error) {
    console.error(
      "Purchase error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to purchase product.",
    });
  }
});

/* =========================
   PROCESS DAILY INCOME
========================= */

router.post(
  "/process-income/:userId",
  async (req, res) => {
    try {
      const { userId } =
        req.params;

      /* =====================
         USER CHECK
      ===================== */

      if (
        !mongoose.Types.ObjectId.isValid(
          userId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid user ID",
        });
      }

      /* =====================
         FIND WALLET
      ===================== */

      const wallet =
        await Wallet.findOne({
          userId,
        });

      if (!wallet) {
        return res.status(404).json({
          success: false,
          message:
            "Wallet not found.",
        });
      }

      /* =====================
         ACTIVE PURCHASES
      ===================== */

      const purchases =
        await Purchase.find({
          userId,

          status: "Active",
        });

      const now =
        Date.now();

      let totalNewIncome = 0;

      let processedProducts = 0;

      /* =====================
         PROCESS PRODUCTS
      ===================== */

      for (
        const purchase
        of purchases
      ) {
        const dailyIncome =
          Number(
            purchase.dailyIncome ||
              0
          );

        const totalIncome =
          Number(
            purchase.totalIncome ||
              0
          );

        const duration =
          Number(
            purchase.duration ||
              0
          );

        const earnedIncome =
          Number(
            purchase.earnedIncome ||
              0
          );

        const creditedDays =
          Number(
            purchase.creditedDays ||
              0
          );

        /* ===================
           INVALID PLAN
        =================== */

        if (
          dailyIncome <= 0 ||
          totalIncome <= 0 ||
          duration <= 0
        ) {
          continue;
        }

        /* ===================
           PURCHASE DATE
        =================== */

        const purchaseTime =
          new Date(
            purchase.purchasedAt ||
              purchase.createdAt
          ).getTime();

        if (
          Number.isNaN(
            purchaseTime
          )
        ) {
          continue;
        }

        /* ===================
           FULL 24H DAYS
        =================== */

        const elapsedTime =
          now -
          purchaseTime;

        const fullDaysPassed =
          Math.floor(
            elapsedTime /
              ONE_DAY
          );

        /*
          Maximum duration tak
          hi income milegi.
        */

        const allowedDays =
          Math.min(
            fullDaysPassed,
            duration
          );

        /* ===================
           UNPAID DAYS
        =================== */

        const newDays =
          Math.max(
            allowedDays -
              creditedDays,
            0
          );

        /* ===================
           NO NEW INCOME
        =================== */

        if (
          newDays <= 0
        ) {
          /*
            Safety:
            duration already
            complete ho gayi.
          */

          if (
            creditedDays >=
              duration ||
            earnedIncome >=
              totalIncome
          ) {
            purchase.status =
              "Completed";

            await purchase.save();
          }

          continue;
        }

        /* ===================
           CALCULATE INCOME
        =================== */

        let incomeToAdd =
          newDays *
          dailyIncome;

        const remainingIncome =
          Math.max(
            totalIncome -
              earnedIncome,
            0
          );

        incomeToAdd =
          Math.min(
            incomeToAdd,
            remainingIncome
          );

        /* ===================
           NOTHING LEFT
        =================== */

        if (
          incomeToAdd <= 0
        ) {
          purchase.status =
            "Completed";

          await purchase.save();

          continue;
        }

        /* ===================
           UPDATE PURCHASE
        =================== */

        const newEarnedIncome =
          earnedIncome +
          incomeToAdd;

        const newCreditedDays =
          allowedDays;

        purchase.earnedIncome =
          newEarnedIncome;

        purchase.creditedDays =
          newCreditedDays;

        purchase.lastIncomeAt =
          new Date();

        /* ===================
           COMPLETE CHECK
        =================== */

        if (
          newCreditedDays >=
            duration ||
          newEarnedIncome >=
            totalIncome
        ) {
          purchase.status =
            "Completed";
        }

        await purchase.save();

        /* ===================
           WALLET TOTAL
        =================== */

        totalNewIncome +=
          incomeToAdd;

        processedProducts += 1;

        /* ===================
           INCOME TRANSACTION
        =================== */

        await Transaction.create({
          userId,

          title:
            "Daily Income",

          description:
            `${purchase.productName} - ${newDays} day${
              newDays > 1
                ? "s"
                : ""
            } income`,

          type:
            "credit",

          amount:
            incomeToAdd,

          category:
            "income",

          status:
            "Completed",

          referenceId:
            String(
              purchase._id
            ),
        });
      }

      /* =====================
         UPDATE WALLET
      ===================== */

      if (
        totalNewIncome > 0
      ) {
        wallet.balance =
          Number(
            wallet.balance || 0
          ) +
          totalNewIncome;

        wallet.totalIncome =
          Number(
            wallet.totalIncome ||
              0
          ) +
          totalNewIncome;

        await wallet.save();
      }

      /* =====================
         RESPONSE
      ===================== */

      return res.json({
        success: true,

        message:
          totalNewIncome > 0
            ? "Daily income credited successfully."
            : "No income due yet.",

        creditedAmount:
          totalNewIncome,

        processedProducts,

        wallet: {
          balance:
            Number(
              wallet.balance || 0
            ),

          totalIncome:
            Number(
              wallet.totalIncome ||
                0
            ),
        },
      });
    } catch (error) {
      console.error(
        "Process income error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Unable to process daily income.",
      });
    }
  }
);

/* =========================
   USER PURCHASES
========================= */

router.get(
  "/user/:userId",
  async (req, res) => {
    try {
      const { userId } =
        req.params;

      /* =====================
         USER CHECK
      ===================== */

      if (
        !mongoose.Types.ObjectId.isValid(
          userId
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid user ID",
        });
      }

      /* =====================
         GET PURCHASES
      ===================== */

      const purchases =
        await Purchase.find({
          userId,
        })
          .sort({
            createdAt: -1,
          })
          .lean();

      /* =====================
         FORMAT RESPONSE
      ===================== */

      const formattedPurchases =
        purchases.map(
          (purchase) => ({
            id:
              purchase._id,

            purchaseId:
              purchase._id,

            userId:
              purchase.userId,

            productId:
              purchase.productId,

            name:
              purchase.productName,

            productName:
              purchase.productName,

              

            image:
              purchase.productImage ||
              "",

            productImage:
              purchase.productImage ||
              "",

            price:
              Number(
                purchase.price || 0
              ),

            dailyIncome:
              Number(
                purchase.dailyIncome ||
                  0
              ),

            totalIncome:
              Number(
                purchase.totalIncome ||
                  0
              ),

            duration:
              Number(
                purchase.duration ||
                  0
              ),

            earnedIncome:
              Number(
                purchase.earnedIncome ||
                  0
              ),

            creditedDays:
              Number(
                purchase.creditedDays ||
                  0
              ),

            status:
              purchase.status,

            purchasedAt:
              purchase.purchasedAt ||
              purchase.createdAt,

            lastIncomeAt:
              purchase.lastIncomeAt ||
              null,

            createdAt:
              purchase.createdAt,
          })
        );

      return res.json({
        success: true,

        count:
          formattedPurchases.length,

        purchases:
          formattedPurchases,
      });
    } catch (error) {
      console.error(
        "Get purchases error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Unable to load purchases.",
      });
    }
  }
);
/* =========================
   ADMIN ALL PURCHASES
========================= */

/* =========================
   ADMIN ALL PURCHASES
========================= */

router.get(
  "/admin/all",
  async (req, res) => {
    try {

      const purchases =
        await Purchase.find()
          .populate(
            "userId",
            "name mobile email"
          )
          .sort({
            createdAt: -1,
          })
          .lean();


      const totalSales =
        purchases.reduce(
          (total, item) =>
            total +
            Number(item.price || 0),
          0
        );


      return res.json({

        success: true,


        summary: {

          totalPurchases:
            purchases.length,

          totalSales,

        },


        purchases:
          purchases.map(
            (purchase) => ({

              id:
                purchase._id,


              userId:
                purchase.userId?._id ||
                purchase.userId,


              customer:
                purchase.userId
                  ? {

                      id:
                        purchase.userId._id,

                      name:
                        purchase.userId.name ||
                        "",

                      mobile:
                        purchase.userId.mobile ||
                        "",

                      email:
                        purchase.userId.email ||
                        "",

                    }

                  : null,


              // ✅ ADD PRODUCT ID
              productId:
                purchase.productId,


              productName:
                purchase.productName,


              productImage:
                purchase.productImage,


              price:
                purchase.price,


              dailyIncome:
                purchase.dailyIncome,


              totalIncome:
                purchase.totalIncome,


              duration:
                purchase.duration,


              earnedIncome:
                purchase.earnedIncome,


              status:
                purchase.status,


              purchasedAt:
                purchase.purchasedAt,


              createdAt:
                purchase.createdAt,


            })
          ),

      });


    } catch(error) {


      console.error(
        "Admin purchases error:",
        error
      );


      return res.status(500).json({

        success:false,

        message:
          "Unable to load purchases",

      });


    }
  }
);
module.exports = router;