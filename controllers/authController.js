const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");
const { uploadMedia, deleteMediaFromCloudinary } = require("../utils/cloudinary");
const InstructorRequest = require("../models/InstructorRequest");
const Course = require("../models/Course");

// Register User & Send OTP
exports.register = async (req, res) => {
  const { username, email, password } = req.body;
  try {
    let user = await User.findOne({ email });

    if (user) {
      if (!user.isVerified) {
        return res.status(400).json({ message: "User already registered. Please verify OTP." });
      }
      return res.status(400).json({ message: "Email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log(otp);
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    user = new User({ username, email, password: hashedPassword, otp, otpExpires });

    await user.save();
    await sendEmail(email, otp, username);

    res.json({ message: "User registered! Please verify OTP." });
  } catch (error) {
    res.status(500).json({ message: "Serverrrrrrrrrr error", error });
  }
};

// Verify OTP
exports.verifyOTP = async (req, res) => {
  const { email, otp } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) return res.status(400).json({ message: "User not found." });
    if (user.otp !== otp) return res.status(400).json({ message: "Invalid OTP." });
    if (user.otpExpires < Date.now()) return res.status(400).json({ message: "OTP expired. Request a new OTP." });

    user.isVerified = true;
    user.otp = null;
    user.otpExpires = null;
    await user.save();

    res.json({ message: "OTP Verified! You can now log in." });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};


// Login User & Set JWT in HTTP-only Cookie
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user || !user.isVerified) {
      return res.status(400).json({ message: "Invalid credentials or unverified email." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

    res.cookie("token", token, {
      httpOnly: true,
      secure: true, // ✅ ensures HTTPS only
      sameSite: 'None', // ✅ required for cross-site cookies
      // secure: process.env.NODE_ENV === "production", // Set true in production
      // sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    res.json({ message: "Login successful", token });
  } catch (error) {
    res.status(500).json({ message: "Serverr error", error });
  }
};


// Logout User (Clear JWT Cookie)
exports.logout = (req, res) => {
  res.clearCookie("token");
  res.json({ message: "Logout successful" });
};

const otpStore = {}; // Temporary OTP storage

// Forgot Password: Generate OTP
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });

  if (!user) return res.status(400).json({ message: "Email not registered" });

  const otp = Math.floor(100000 + Math.random() * 900000);
  otpStore[email] = otp;
  console.log(otp, email);
  // await sendEmail(email, otp,user.username);
  res.json({ message: "OTP sent to your email" });
};

// Reset Password: Verify OTP & Update Password
exports.resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  console.log("Received OTP:", otp, "Stored OTP:", otpStore[email]);

  if (!otpStore[email]) {
    return res.status(400).json({ message: "OTP expired or not found" });
  }

  if (parseInt(otp) !== otpStore[email]) {
    return res.status(400).json({ message: "Invalid OTP" });
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  await User.updateOne({ email }, { password: hashedPassword });
  delete otpStore[email];

  res.json({ message: "Password reset successfully" });
};

// Get User Profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
};

// Get User Profile (Protected Route)
exports.authenticate = async (req, res) => {
  try {

    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
};

// Update User Profile 
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user;
    const { username, oldPassword, newPassword } = req.body;
    const profilePhoto = req.file;


    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        message: "User not found",
        success: false,
      });
    }


    if (oldPassword && newPassword) {
      const isMatch = await bcrypt.compare(oldPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({
          message: "Old password is incorrect",
          success: false,
        });
      }


      const hashedPassword = await bcrypt.hash(newPassword, 12);
      user.password = hashedPassword;
    }


    if (user.photoUrl) {
      const publicId = user.photoUrl.split("/").pop().split(".")[0];
      await deleteMediaFromCloudinary(publicId);
    }


    let photoUrl = user.photoUrl;
    if (profilePhoto) {
      const cloudResponse = await uploadMedia(profilePhoto.buffer);
      if (!cloudResponse || !cloudResponse.secure_url) {
        return res.status(500).json({
          success: false,
          message: "Failed to upload image to Cloudinary",
        });
      }
      photoUrl = cloudResponse.secure_url;
    }


    const updatedData = { username, photoUrl, password: user.password };
    const updatedUser = await User.findByIdAndUpdate(userId, updatedData, { new: true }).select("-password");

    return res.status(200).json({
      success: true,
      user: updatedUser,
      message: "Profile updated successfully.",
    });
  } catch (error) {
    console.error("Update Profile Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update profile",
    });
  }
};


// Get User Role
exports.userrole = async (req, res) => {
  person = req.user;
  userdata = await User.findById(person);
  role = userdata.role;
  res.json(role);
};

//isloggedin or not
exports.isLoggedIn = (req, res) => {
  res.status(200).json({ message: "User is logged in", userId: req.user });
};

exports.myCourses = async (req, res) => {
  try {
    const user = await User.findById(req.user).populate("enrolledCourses");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.json({ success: true, courses: user.enrolledCourses });
  } catch (error) {
    console.error("Error fetching enrolled courses:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.toggleSavedCourse = async (req, res) => {
  try {
    const userId = req.user;
    const { courseId } = req.body;

    if (!courseId) {
      return res.status(400).json({ message: "Course ID is required" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const courseIndex = user.savedCourses.indexOf(courseId);

    if (courseIndex > -1) {
      // If course is already saved, remove it
      user.savedCourses.splice(courseIndex, 1);
      await user.save();
      return res.status(200).json({ message: "Course removed from saved", saved: false });
    } else {
      // If course is not saved, add it
      user.savedCourses.push(courseId);
      await user.save();
      return res.status(200).json({ message: "Course added to saved", saved: true });
    }
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};


exports.getSavedCourses = async (req, res) => {
  try {
    const userId = req.user;
    const user = await User.findById(userId).populate("savedCourses");

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json(user.savedCourses);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

exports.instructorrequest = async (req, res) => {
  try {
    const userId = req.user;
    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role !== "student") return res.status(400).json({ message: "Only students can request instructor access" });

    const existingRequest = await InstructorRequest.findOne({ userId });
    if (existingRequest) return res.status(400).json({ message: "Request already submitted" });

    const request = new InstructorRequest({ userId });
    await request.save();

    res.status(201).json({ message: "Instructor request submitted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

exports.checkCourse = async (req, res) => {
  try {
    const { title } = req.body;
    if (!title) {
      return res.status(400).json({ success: false, message: "Course title is required" });
    }
    const existingCourse = await Course.findOne({ title });
    console.log(existingCourse);
    if (existingCourse) {
      return res.status(200).json({
        success: true,
        message: "Course is already available",
        course: existingCourse,
      });
    } else {
      return res.status(404).json({
        success: false,
        message: "Course is not available",
      });
    }
  } catch (error) {
    console.error("Error checking course:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

exports.getallinstrucors = async (req, res) => {
  try {
    const instructors = await User.find({ role: "instructor" }).select("-password");
    res.status(200).json(instructors);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch instructors", error: error.message });
  }
};

exports.pramoteadmin = async (req, res) => {
  const { id } = req.params;
  try {
    const updatedUser = await User.findByIdAndUpdate(id, { role: "admin" }, { new: true });
    if (!updatedUser) return res.status(404).json({ error: "Instructor not found" });
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: "Failed to promote instructor" });
  }
};


exports.demotestudent = async (req, res) => {
  const { id } = req.params;
  try {
    const updatedUser = await User.findByIdAndUpdate(id, { role: "student" }, { new: true });
    if (!updatedUser) return res.status(404).json({ error: "Instructor not found" });
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ error: "Failed to demote instructor" });
  }
};


