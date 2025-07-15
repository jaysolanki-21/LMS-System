const express = require("express");
const { addLecture, updateLecture, deleteLecture } = require("../controllers/LectureController");
const router = express.Router();
const multer = require("multer");

// Configure multer to store the file in memory (optional, based on your storage setup)
const storage = multer.memoryStorage();
const upload = multer({ storage });


router.post("/add", addLecture);

router.put("/update/:lectureId", updateLecture);

router.delete("/delete/:courseId/:lectureId", deleteLecture);

module.exports = router;
