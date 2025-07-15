const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    isVerified: { type: Boolean, default: false },
    otp: String,
    otpExpires: Date,
    role: {
      type: String,
      enum: ["instructor", "student", "pending-instructor"],
      default: "student",
    },
    isInstructorApproved: {
      type: Boolean,
      default: false,
    },
    enrolledCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
    savedCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
    photoUrl: { type: String, default: "" },
  },
  { timestamps: true }
);

// module.exports = mongoose.model("User", userSchema);

// const mongoose = require("mongoose");
// const { z } = require("zod");

// // Define Zod Validation Schema
// const userValidationSchema = z.object({
//   username: z.string().min(3, "Username must be at least 3 characters long"),
//   email: z.string().email("Invalid email format"),
//   password: z
//     .string()
//     .min(8, "Password must be at least 8 characters long")
//     .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
//     .regex(/[a-z]/, "Password must contain at least one lowercase letter")
//     .regex(/\d/, "Password must contain at least one number")
//     .regex(/[@$!%*?&]/, "Password must contain at least one special character"),
//   isVerified: z.boolean().default(false),
//   otp: z.string().optional(),
//   otpExpires: z.date().optional(),
//   role: z.enum(["instructor", "student", "pending-instructor"]).default("student"),
//   isInstructorApproved: z.boolean().default(false),
//   enrolledCourses: z.array(z.string()).optional(), // MongoDB ObjectId will be strings
//   savedCourses: z.array(z.string()).optional(),
//   photoUrl: z.string().optional(),
// });

// // Define Mongoose Schema
// const userSchema = new mongoose.Schema(
//   {
//     username: { type: String, required: true },
//     email: { type: String, unique: true, required: true },
//     password: { type: String, required: true },
//     isVerified: { type: Boolean, default: false },
//     otp: String,
//     otpExpires: Date,
//     role: {
//       type: String,
//       enum: ["instructor", "student", "pending-instructor"],
//       default: "student",
//     },
//     isInstructorApproved: {
//       type: Boolean,
//       default: false,
//     },
//     enrolledCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
//     savedCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
//     photoUrl: { type: String, default: "" },
//   },
//   { timestamps: true }
// );

// // Middleware to Validate with Zod Before Saving
// userSchema.pre("save", function (next) {
//   try {
//     userValidationSchema.parse(this.toObject()); // Validate the user data
//     next();
//   } catch (error) {
//     next(error); // Pass the error to Mongoose
//   }
// });

module.exports = mongoose.model("User", userSchema);
