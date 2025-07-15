const express = require("express");
const { addCourse, getAllCourses, getCourseById, updateCourse, deleteCourse, lecturesvideo, isEncrolled, getAllMyCourses, postReview, getReviews, deletereview, confirminstructor} = require("../controllers/courseController");
const authenticateAdmin = require("../middleware/adminMiddleware");
const upload = require("../middleware/upload");
const checkEnrollment = require("../middleware/coureMiddleware");
const authenticateUser = require("../middleware/authMiddleware");
const { isErrored } = require("nodemailer/lib/xoauth2");
const { authenticateToken , isAdmin } = require("../middleware/isAdminMiddleware");


const router = express.Router();

router.post("/add-course", authenticateAdmin ,upload.single("courseImage"), addCourse);        
router.get("/my",authenticateAdmin, getAllMyCourses);    
router.get("/",getAllCourses);    
router.get("/confirminstructor/:id",authenticateUser,confirminstructor);
router.post("/:courseId/reviews",authenticateUser,postReview);
router.get("/:courseId/reviews", getReviews);
router.delete('/reviews/:reviewId', authenticateAdmin, deletereview); 
router.get("/:id", getCourseById);   
router.put("/:id",authenticateAdmin,upload.single("courseImage"), updateCourse);     
router.delete("/:id",authenticateAdmin, deleteCourse);  
router.get("/:courseId/lecturesdetails",authenticateUser,checkEnrollment, lecturesvideo); 
router.get("/is-enrolled/:courseId", authenticateUser, isEncrolled);
router.get("/:courseId/lectures",authenticateAdmin, lecturesvideo); 






module.exports = router;
