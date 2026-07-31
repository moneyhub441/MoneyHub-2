const express = require("express");
const bcrypt = require("bcryptjs");

const User = require("../models/User");

const router = express.Router();

/* =========================
   GENERATE INVITE CODE
========================= */

const generateInviteCode = () => {
  const number = Math.floor(
    10000 + Math.random() * 90000
  );

  return `MH${number}`;
};

/* =========================
   REGISTER
========================= */

router.post("/register", async (req, res) => {
  try {
    const {
      name,
      mobile,
      email,
      password,
      referralCode,
    } = req.body;

    if (!name || !mobile || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Name, mobile and password are required",
      });
    }

    const cleanMobile = String(
      mobile
    ).trim();

    const existingUser =
      await User.findOne({
        mobile: cleanMobile,
      });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message:
          "Mobile number already registered",
      });
    }

    let referredBy = "";

    if (referralCode) {
      const referrer = await User.findOne({
        inviteCode: String(
          referralCode
        )
          .trim()
          .toUpperCase(),
      });

      if (!referrer) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid referral code",
        });
      }

      referredBy =
        referrer.inviteCode;
    }

    const hashedPassword =
      await bcrypt.hash(password, 10);

    let inviteCode =
      generateInviteCode();

    while (
      await User.exists({
        inviteCode,
      })
    ) {
      inviteCode =
        generateInviteCode();
    }

    const user = await User.create({
      name: name.trim(),

      mobile: cleanMobile,

      email: email
        ? email.trim()
        : "",

      password: hashedPassword,

      inviteCode,

      referredBy,
    });

    return res.status(201).json({
      success: true,

      message:
        "Account created successfully",

      user: {
        id: user._id,
        name: user.name,
        mobile: user.mobile,
        email: user.email,
        inviteCode:
          user.inviteCode,
        walletBalance:
          user.walletBalance,
      },
    });
  } catch (error) {
    console.error(
      "Register error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to create account",
    });
  }
});

/* =========================
   LOGIN
========================= */

router.post("/login", async (req, res) => {
  try {
    const { mobile, password } =
      req.body;

    if (!mobile || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Mobile and password are required",
      });
    }

    const user = await User.findOne({
      mobile: String(
        mobile
      ).trim(),
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid mobile or password",
      });
    }

    if (user.status === "Blocked") {
      return res.status(403).json({
        success: false,
        message:
          "Your account has been blocked",
      });
    }

    const passwordMatched =
      await bcrypt.compare(
        password,
        user.password
      );

    if (!passwordMatched) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid mobile or password",
      });
    }

    return res.json({
      success: true,

      message:
        "Login successful",

      user: {
        id: user._id,
        name: user.name,
        mobile: user.mobile,
        email: user.email,
        inviteCode:
          user.inviteCode,
        walletBalance:
          user.walletBalance,
      },
    });
  } catch (error) {
    console.error(
      "Login error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to login",
    });
  }
});
/* =========================
   REFERRAL / PROMOTION DATA
========================= */

router.get(
  "/referrals/:userId",
  async (req, res) => {
    try {
      const { userId } = req.params;

      const user =
        await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const referredUsers =
        await User.find({
          referredBy:
            user.inviteCode,
        })
          .select(
            "name mobile createdAt status"
          )
          .sort({
            createdAt: -1,
          });

      return res.json({
        success: true,

        inviteCode:
          user.inviteCode,

        totalInvites:
          referredUsers.length,

        joined:
          referredUsers.length,

        referrals:
          referredUsers.map(
            (item) => ({
              id: item._id,

              name:
                item.name,

              mobile:
                item.mobile,

              status:
                item.status,

              createdAt:
                item.createdAt,
            })
          ),
      });
    } catch (error) {
      console.error(
        "Referral data error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load referral data",
      });
    }
  }
);
/* =========================
   GET USER PROFILE
========================= */

router.get(
  "/profile/:userId",
  async (req, res) => {
    try {
      const user = await User.findById(
        req.params.userId
      ).select("-password");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      return res.json({
        success: true,

        user: {
          id: user._id,
          name: user.name,
          mobile: user.mobile,
          email: user.email || "",
          inviteCode: user.inviteCode,
          walletBalance: user.walletBalance,
          status: user.status,
        },
      });
    } catch (error) {
      console.error(
        "Get profile error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to load profile",
      });
    }
  }
);

/* =========================
   UPDATE USER PROFILE
========================= */

router.put(
  "/profile/:userId",
  async (req, res) => {
    try {
      const { name, email } =
        req.body;

      if (!name?.trim()) {
        return res.status(400).json({
          success: false,
          message:
            "Full name is required",
        });
      }

      const user =
        await User.findById(
          req.params.userId
        );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      user.name = name.trim();

      user.email = email
        ? email.trim().toLowerCase()
        : "";

      await user.save();

      return res.json({
        success: true,
        message:
          "Profile updated successfully",

        user: {
          id: user._id,
          name: user.name,
          mobile: user.mobile,
          email: user.email,
          inviteCode:
            user.inviteCode,
          walletBalance:
            user.walletBalance,
          status: user.status,
        },
      });
    } catch (error) {
      console.error(
        "Update profile error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to update profile",
      });
    }
  }
);
/* =========================
   CHANGE MOBILE
========================= */

router.put(
  "/change-mobile/:userId",
  async (req, res) => {
    try {
      const { userId } = req.params;
      const { mobile } = req.body;

      const cleanMobile =
        String(mobile || "").replace(
          /\D/g,
          ""
        );

      /* VALIDATION */

      if (cleanMobile.length !== 10) {
        return res.status(400).json({
          success: false,
          message:
            "Please enter a valid 10 digit mobile number",
        });
      }

      /* FIND CURRENT USER */

      const user =
        await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      /* SAME MOBILE */

      if (
        user.mobile === cleanMobile
      ) {
        return res.status(400).json({
          success: false,
          message:
            "This is already your registered mobile number",
        });
      }

      /* DUPLICATE MOBILE CHECK */

      const existingUser =
        await User.findOne({
          mobile: cleanMobile,
          _id: {
            $ne: user._id,
          },
        });

      if (existingUser) {
        return res.status(409).json({
          success: false,
          message:
            "This mobile number is already registered",
        });
      }

      /* UPDATE */

      user.mobile = cleanMobile;

      await user.save();

      return res.json({
        success: true,

        message:
          "Mobile number updated successfully",

        user: {
          id: user._id,
          name: user.name,
          mobile: user.mobile,
          email: user.email || "",
          inviteCode:
            user.inviteCode,
          walletBalance:
            user.walletBalance,
          status: user.status,
        },
      });
    } catch (error) {
      console.error(
        "Change mobile error:",
        error
      );

      /* MONGODB DUPLICATE ERROR */

      if (error?.code === 11000) {
        return res.status(409).json({
          success: false,
          message:
            "This mobile number is already registered",
        });
      }

      return res.status(500).json({
        success: false,
        message:
          "Unable to update mobile number",
      });
    }
  }
);
/* =========================
   CHANGE PASSWORD
========================= */

router.put(
  "/change-password/:userId",
  async (req, res) => {
    try {
      const { userId } = req.params;

      const {
        currentPassword,
        newPassword,
      } = req.body;

      /* =========================
         VALIDATION
      ========================= */

      if (
        !currentPassword ||
        !newPassword
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Current password and new password are required",
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message:
            "New password must be at least 6 characters",
        });
      }

      /* =========================
         FIND USER
      ========================= */

      const user =
        await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      /* =========================
         CHECK CURRENT PASSWORD
      ========================= */

      const passwordCorrect =
        await bcrypt.compare(
          currentPassword,
          user.password
        );

      if (!passwordCorrect) {
        return res.status(401).json({
          success: false,
          message:
            "Current password is incorrect",
        });
      }

      /* =========================
         SAME PASSWORD CHECK
      ========================= */

      const samePassword =
        await bcrypt.compare(
          newPassword,
          user.password
        );

      if (samePassword) {
        return res.status(400).json({
          success: false,
          message:
            "New password must be different from current password",
        });
      }

      /* =========================
         HASH NEW PASSWORD
      ========================= */

      const hashedPassword =
        await bcrypt.hash(
          newPassword,
          12
        );

      /* =========================
         SAVE
      ========================= */

      user.password =
        hashedPassword;

      await user.save();

      return res.json({
        success: true,
        message:
          "Password updated successfully",
      });
    } catch (error) {
      console.error(
        "Change password error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to change password",
      });
    }
  }
);
/* =========================
   ADMIN - ALL USERS
========================= */

router.get(
  "/admin/users",
  async (req, res) => {
    try {

      const users =
        await User.find()
          .select("-password")
          .sort({
            createdAt: -1,
          });

      return res.json({
        success: true,

        totalUsers:
          users.length,

        users:
          users.map(
            (user) => ({
              id:
                user._id,

              name:
                user.name,

              mobile:
                user.mobile,

              email:
                user.email || "",

              inviteCode:
                user.inviteCode,

              status:
                user.status,

              createdAt:
                user.createdAt,
            })
          ),
      });

    } catch (error) {

      console.error(
        "Admin users error:",
        error
      );

      return res.status(500).json({
        success:false,

        message:
          "Unable to load users",
      });
    }
  }
);
/* =========================
   ADMIN - SINGLE USER
========================= */

router.get(
  "/admin/users/:id",
  async (req, res) => {
    try {

      const user =
        await User.findById(
          req.params.id
        )
        .select("-password");


      if (!user) {
        return res.status(404).json({
          success:false,
          message:"User not found"
        });
      }


      return res.json({
        success:true,

        user:{
          id:user._id,
          name:user.name,
          mobile:user.mobile,
          email:user.email || "",
          inviteCode:user.inviteCode,
          status:user.status,
          createdAt:user.createdAt
        }
      });


    } catch(error){

      console.log(
        "Single user error",
        error
      );


      return res.status(500).json({
        success:false,
        message:"Unable to load user"
      });

    }
  }
);
module.exports = router;