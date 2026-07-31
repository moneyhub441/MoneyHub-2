const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const Wallet = require("./models/Wallet");
const Transaction = require("./models/Transaction");

const purchaseRoutes =
  require("./routes/purchaseRoutes");
const walletRoutes =
  require("./routes/walletRoutes");
  const withdrawalRoutes =
  require("./routes/withdrawalRoutes");
const authRoutes = require(
  "./routes/authRoutes"
);

dotenv.config();

const app = express();

/* =========================
   MIDDLEWARE
========================= */

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());
app.use(
  "/api/wallet",
  walletRoutes
);
app.use(
  "/api/purchases",
  purchaseRoutes
);
app.use(
  "/api/withdrawals",
  withdrawalRoutes
);
app.use(
  "/api/auth",
  authRoutes
);
/* =========================
   MONGODB CONNECTION
========================= */

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error(
        "MONGO_URI is missing from backend/.env"
      );
    }

    await mongoose.connect(
      process.env.MONGO_URI
    );

    console.log(
      "MongoDB connected successfully"
    );
  } catch (error) {
    console.error(
      "MongoDB connection error:",
      error.message
    );

    process.exit(1);
  }
};

/* =========================
   CASHFREE CONFIG
========================= */

const CASHFREE_BASE_URL =
  process.env.CASHFREE_ENV === "production"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";

/* =========================
   CREATE CASHFREE ORDER
========================= */

app.post(
  "/api/payment/create-order",
  async (req, res) => {
    try {
      const {
        amount,
        customerPhone,
        customerId,
      } = req.body;

      const numericAmount =
        Number(amount);

      if (
        !numericAmount ||
        numericAmount < 100
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid amount",
        });
      }

      if (!customerPhone) {
        return res.status(400).json({
          success: false,
          message:
            "Customer phone is required",
        });
      }

      if (
        !process.env.CASHFREE_APP_ID ||
        !process.env.CASHFREE_SECRET_KEY
      ) {
        return res.status(500).json({
          success: false,
          message:
            "Cashfree credentials are missing",
        });
      }

      const orderId =
        `ORDER_${Date.now()}`;

      const response = await fetch(
        `${CASHFREE_BASE_URL}/orders`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Accept:
              "application/json",

            "x-client-id":
              process.env
                .CASHFREE_APP_ID,

            "x-client-secret":
              process.env
                .CASHFREE_SECRET_KEY,

            "x-api-version":
              "2025-01-01",
          },

          body: JSON.stringify({
            order_id: orderId,

            order_amount:
              numericAmount,

            order_currency: "INR",

            customer_details: {
              customer_id:
                customerId
                  ? String(customerId)
                  : `USER_${Date.now()}`,

              customer_phone:
                String(customerPhone),
            },

            order_meta: {
              return_url:
                `${process.env.FRONTEND_URL}/payment-status?order_id={order_id}`,
            },
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        console.error(
          "Cashfree error:",
          data
        );

        return res
          .status(response.status)
          .json({
            success: false,

            message:
              "Unable to create payment order",

            error: data,
          });
      }

      return res.json({
        success: true,

        orderId:
          data.order_id,

        paymentSessionId:
          data.payment_session_id,
      });
    } catch (error) {
      console.error(
        "Create order error:",
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
   VERIFY PAYMENT + CREDIT WALLET
========================= */

app.get(
  "/api/payment/verify/:orderId",
  async (req, res) => {
    try {
      const { orderId } = req.params;

      const userId = String(
        req.query.userId || ""
      );

      /* =========================
         USER ID CHECK
      ========================= */

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

      /* =========================
         CASHFREE CREDENTIAL CHECK
      ========================= */

      if (
        !process.env.CASHFREE_APP_ID ||
        !process.env.CASHFREE_SECRET_KEY
      ) {
        return res.status(500).json({
          success: false,
          message:
            "Cashfree credentials are missing",
        });
      }

      /* =========================
         VERIFY WITH CASHFREE
      ========================= */

      const response = await fetch(
        `${CASHFREE_BASE_URL}/orders/${orderId}/payments`,
        {
          method: "GET",

          headers: {
            Accept: "application/json",

            "x-client-id":
              process.env.CASHFREE_APP_ID,

            "x-client-secret":
              process.env.CASHFREE_SECRET_KEY,

            "x-api-version":
              "2025-01-01",
          },
        }
      );

      const payments =
        await response.json();

      if (!response.ok) {
        console.error(
          "Cashfree verification error:",
          payments
        );

        return res
          .status(response.status)
          .json({
            success: false,

            message:
              "Unable to verify payment",

            error: payments,
          });
      }

      /* =========================
         SUCCESS PAYMENT
      ========================= */

      const successfulPayment =
        Array.isArray(payments)
          ? payments.find(
              (payment) =>
                payment.payment_status ===
                "SUCCESS"
            )
          : null;

      if (!successfulPayment) {
        return res.json({
          success: false,

          status: "NOT_PAID",

          message:
            "Payment is not completed",
        });
      }

      /* =========================
         PAYMENT AMOUNT
      ========================= */

      const paymentAmount =
        Number(
          successfulPayment.payment_amount
        );

      if (
        !Number.isFinite(paymentAmount) ||
        paymentAmount <= 0
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Invalid payment amount",
        });
      }

      /* =========================
         DUPLICATE CHECK
      ========================= */

      const existingTransaction =
        await Transaction.findOne({
          referenceId: orderId,

          category:
            "add_balance",

          status:
            "Completed",
        });

      /*
        Same Cashfree order pehle
        credit ho chuka hai to
        dobara balance add nahi hoga.
      */

      if (existingTransaction) {
        const existingWallet =
          await Wallet.findOne({
            userId,
          });

        return res.json({
          success: true,

          status: "PAID",

          alreadyCredited: true,

          message:
            "Payment already credited",

          orderId,

          amount:
            paymentAmount,

          balance:
            Number(
              existingWallet?.balance ||
                0
            ),
        });
      }

      /* =========================
         GET / CREATE WALLET
      ========================= */

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

      /* =========================
         CREDIT WALLET
      ========================= */

      wallet.balance =
Number(wallet.balance || 0)
+
paymentAmount;


wallet.totalAdded =
Number(wallet.totalAdded || 0)
+
paymentAmount;


await wallet.save();

      /* =========================
         CREATE TRANSACTION
      ========================= */

      try {
        await Transaction.create({
          userId,

          title:
            "Balance Added",

          description:
            "Cashfree payment",

          type:
            "credit",

          amount:
            paymentAmount,

          category:
            "add_balance",

          status:
            "Completed",

          referenceId:
            orderId,
        });
      } catch (transactionError) {

        /*
          Transaction save fail hui
          to wallet rollback.
        */

        wallet.balance =
          Math.max(
            Number(
              wallet.balance
            ) - paymentAmount,
            0
          );

        wallet.totalAdded =
          Math.max(
            Number(
              wallet.totalAdded
            ) - paymentAmount,
            0
          );

        await wallet.save();

        throw transactionError;
      }

      /* =========================
         SUCCESS
      ========================= */

      return res.json({
        success: true,

        status: "PAID",

        alreadyCredited: false,

        message:
          "Payment successful. Balance added to your wallet.",

        orderId,

        amount:
          paymentAmount,

        balance:
          wallet.balance,
      });
    } catch (error) {
      console.error(
        "Payment verification error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Unable to verify payment",
      });
    }
  }
);

/* =========================
   DATABASE TEST
========================= */

app.get(
  "/api/database-status",
  (req, res) => {
    const connected =
      mongoose.connection.readyState ===
      1;

    return res.json({
      success: connected,

      database: connected
        ? "connected"
        : "disconnected",

      databaseName:
        mongoose.connection.name ||
        null,
    });
  }
);

/* =========================
   HOME TEST
========================= */

app.get("/", (req, res) => {
  res.send(
    "Money Hub backend working"
  );
});

/* =========================
   404
========================= */

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    message: "API route not found",
  });
});

/* =========================
   START SERVER
========================= */

const PORT =
  process.env.PORT || 5000;


const startServer = async () => {

  await connectDB();

  app.listen(PORT, () => {

    console.log(
      `Money Hub server running on http://localhost:${PORT}`
    );

  });

};


if (require.main === module) {

  startServer();

}


module.exports = app;