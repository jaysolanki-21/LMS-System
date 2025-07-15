const multer = require('multer');
const cloudinary = require("cloudinary").v2;
const Course = require("../models/Course");
const Lecture = require("../models/Lecture");
const fs = require("fs");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});



const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); 
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});


const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'), false); 
  }
};


const upload = multer({ storage, fileFilter }).single('lectureVideo'); 


const addLecture = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        console.error("Multer Error:", err); // Log Multer errors
        return res.status(400).json({ message: "File upload failed", error: err.message });
      }
     
      const { courseId, lectureTitle, isPreviewFree } = req.body;
      
      if (!req.file) {
        return res.status(400).json({ message: "Lecture video is required" });
      }

      if (!courseId || !lectureTitle) {
        return res.status(400).json({ message: "Course ID and Lecture Title are required" });
      }

      try {
        // Upload video to Cloudinary
        const videoUploadResponse = await cloudinary.uploader.upload(req.file.path, {
          resource_type: "video", 
          folder: "coursevideo",  
          
        });
        
        const videoUrl = videoUploadResponse.secure_url; 

        // Delete the temporary file
        fs.unlink(req.file.path, (err) => {
          if (err) {
            console.error("Error deleting temporary file:", err);
          }
        });

        const newLecture = new Lecture({
          lectureTitle,
          videoUrl,
          isPreviewFree,
        });

        const savedLecture = await newLecture.save();

        // Update course with new lecture
        await Course.findByIdAndUpdate(courseId, {
          $push: { lectures: savedLecture._id },
        });

        res.status(201).json({ message: "Lecture added successfully", lecture: savedLecture });
      } catch (cloudinaryError) {
        console.error("Cloudinary Upload Error:", cloudinaryError); // Log Cloudinary upload errors
        return res.status(500).json({ message: "Error uploading to Cloudinary", error: cloudinaryError.message });
      }
    });
  } catch (error) {
    console.error("Server Error:", error); // Log server errors
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};



// const addLecture = async (req, res) => {
//   try {
//     const { courseId, lectureTitle, isPreviewFree } = req.body;
//     if (!req.file) {
//       return res.status(400).json({ message: "Lecture video is required" });
//     }

//     // Upload video to Cloudinary
//     const videoUploadResponse = await cloudinary.uploader.upload(req.file.path, {
//       resource_type: "video",  // Specify that the file being uploaded is a video
//       folder: "coursevideo",    // Store the video in the coursevideo folder
//     });

//     const videoUrl = videoUploadResponse.secure_url; // Get the video URL

//     const newLecture = new Lecture({
//       lectureTitle,
//       videoUrl,
//       isPreviewFree,
//     });

//     const savedLecture = await newLecture.save();

//     await Course.findByIdAndUpdate(courseId, {
//       $push: { lectures: savedLecture._id },
//     });

//     res.status(201).json({ message: "Lecture added successfully", lecture: savedLecture });
//   } catch (error) {
//     res.status(500).json({ message: "Server Error", error });
//   }
// };

const updateLecture = async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        console.error("Multer Error:", err);
        return res.status(400).json({ message: "File upload failed", error: err.message });
      }

      const { lectureId } = req.params;
      const { lectureTitle } = req.body;

      // Find the existing lecture
      const lecture = await Lecture.findById(lectureId);
      if (!lecture) {
        return res.status(404).json({ message: "Lecture not found" });
      }

      // Handle video upload if a new video is provided
      let videoUrl = lecture.videoUrl;

      if (req.file) {
        // Upload new video to Cloudinary
        const cloudinaryUpload = await cloudinary.uploader.upload(req.file.path, {
          resource_type: "video",
          folder: "coursevideo",
        });

        videoUrl = cloudinaryUpload.secure_url;

        // Delete temporary local file
        fs.unlink(req.file.path, (err) => {
          if (err) console.error("Error deleting temporary file:", err);
        });

        // Delete old video from Cloudinary if it exists
        if (lecture.videoUrl) {
          const oldPublicId = lecture.videoUrl.split("/").slice(-1)[0].split(".")[0];
          await cloudinary.uploader.destroy(`coursevideo/${oldPublicId}`, {
            resource_type: "video",
          });
        }
      }

      // Update lecture details
      lecture.lectureTitle = lectureTitle || lecture.lectureTitle;
      lecture.videoUrl = videoUrl;
      await lecture.save();

      res.status(200).json({ message: "Lecture updated", lecture });
    });
  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};



const deleteLecture = async (req, res) => {
  try {
    const { lectureId, courseId } = req.params;

    // Find the lecture by ID
    const lecture = await Lecture.findById(lectureId);
    if (!lecture) return res.status(404).json({ message: "Lecture not found" });

    // Extract the public ID from the video URL to delete the video from Cloudinary
    const videoPublicId = lecture.videoUrl.split("/").pop().split(".")[0];  // Extract the public ID of the video
    console.log(`Attempting to delete video with Public ID: ${videoPublicId}`); // Log the public ID for debugging

    // Delete the video from Cloudinary
    const cloudinaryDeleteResponse = await cloudinary.uploader.destroy(videoPublicId, {
      resource_type: "video",  // Specify that it's a video
    });

    // Check if the Cloudinary video deletion was successful
    if (cloudinaryDeleteResponse.result === "ok") {
      console.log(`Video with Public ID: ${videoPublicId} deleted successfully from Cloudinary.`);
    } else {
      console.error(`Failed to delete video with Public ID: ${videoPublicId} from Cloudinary.`);
    }

    // Delete the lecture from the database
    await Lecture.findByIdAndDelete(lectureId);
    
    // Remove the lecture ID from the course's lectures array
    await Course.findByIdAndUpdate(courseId, { $pull: { lectures: lectureId } });

    res.json({ message: "Lecture deleted successfully" });
  } catch (error) {
    // Handle any errors that occur during the deletion process
    console.error("Error deleting the lecture:", error);
    res.status(500).json({ message: "Server Error", error });
  }
};


module.exports = { addLecture, updateLecture, deleteLecture };
