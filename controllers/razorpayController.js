const Razorpay = require("razorpay");
const crypto = require("crypto");
const User = require("../models/User");
const Course = require("../models/Course");
const Payment = require("../models/Payment");

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,  
  key_secret: process.env.RAZORPAY_SECRET,
});


const createOrder = async (req, res) => {
  try {
    const { amount, currency } = req.body;

    
    const amountInPaise = amount * 100; 

    const options = {
      amount: amountInPaise, 
      currency: currency || "INR",
      receipt: `order_rcptid_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    res.status(200).json({ success: true, order });
  } catch (error) {
    res.status(500).json({ success: false, message: "Payment initiation failed", error: error.message });
  }
};



const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, courseId } = req.body;
    const userId = req.user.id; 

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature === razorpay_signature) {
      await User.findByIdAndUpdate(userId, { $addToSet: { enrolledCourses: courseId } });

      await Course.findByIdAndUpdate(courseId, { $addToSet: { enrolledStudents: userId } });

      res.status(200).json({ success: true, message: "Payment successful, enrollment updated" });
    } else {
      res.status(400).json({ success: false, message: "Invalid payment signature" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: "Payment verification failed", error: error.message });
  }
};

const paymentsuccess = async (req, res) => {
  try {
    const { courseId, razorpayOrderId, razorpayPaymentId, amountPaid } = req.body;
    const userId = req.user;
   
   
    const newPayment = new Payment({
      user: userId, 
      course: courseId,
      razorpayOrderId,
      razorpayPaymentId,
      amountPaid: amountPaid / 100, 
      status: "Success",
    });

    await newPayment.save();

    
    await User.findByIdAndUpdate(userId, { $addToSet: { enrolledCourses: courseId } }); // Use $addToSet to avoid duplicates
    await Course.findByIdAndUpdate(courseId, { $addToSet: { enrolledStudents: userId } });

    res.status(200).json({ success: true, message: "Payment recorded & user enrolled!" });
  } catch (error) {
    console.error("Error saving payment:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

const getAllEnrolledStudents = async (req, res) => {
  try {
    const enrolledStudents = await Payment.find()
      .populate("user", "username") 
      .populate("course", "title") 
      .select("createdAt"); 

    const formattedStudents = enrolledStudents.map((payment) => ({
      id: payment._id,
      name: payment.user.username,
      course: payment.course.title,
      date: new Date(payment.createdAt).toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    }));

    res.status(200).json(formattedStudents);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch enrolled students" });
  }
};

const getEnrolledStudents = async (req, res) => {
  try {
    const instructorId = req.user; 

  
    const courses = await Course.find({ instructor: instructorId });

    if (!courses.length) {
      return res.status(404).json({ message: "No courses found for this instructor" });
    }

   
    const courseIds = courses.map((course) => course._id);

 
    const enrolledStudents = await Payment.find({ course: { $in: courseIds } })
      .populate("user", "username") 
      .populate("course", "title")
      .select("createdAt"); 

    
    const formattedStudents = enrolledStudents.map((payment) => ({
      id: payment._id,
      name: payment.user.username,
      course: payment.course.title,
      date: new Date(payment.createdAt).toLocaleDateString("en-US", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    }));

    res.status(200).json(formattedStudents);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch enrolled students" });
  }
};

const enrolledstudent = async (req, res) => {
  const { courseId } = req.query; 
  
  try {
    if (!courseId) {
      return res.status(400).json({ message: "Course ID is required" });
    }

   
    const payments = await Payment.find({ course: courseId })
      .populate("user", "username email")  
      .select("user razorpayOrderId createdAt");

    if (!payments.length) {
      return res.status(404).json({ message: "No students enrolled in this course" });
    }

   
    const enrolledStudents = payments.map((payment) => ({
      name: payment.user.username,
      email: payment.user.email,
      razorpayOrderId: payment.razorpayOrderId,
      createdAt: payment.createdAt,
    }));

    res.status(200).json(enrolledStudents);
  } catch (err) {
    console.error("Error fetching enrolled students:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};







module.exports = { createOrder, verifyPayment ,paymentsuccess, getEnrolledStudents,getAllEnrolledStudents,enrolledstudent,getEnrolledStudents};
