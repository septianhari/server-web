const express = require("express");
const multer = require("multer");
const path = require("path");
const tf = require("@tensorflow/tfjs-node"); // Add TensorFlow.js for Node.js
const fs = require("fs");
const crypto = require("crypto");
const app = express();
const PORT = process.env.PORT || 4040;
let model;
// Load the model

async function loadModel() {
  model = await tf.loadGraphModel("file://models/model.json");
  console.log("Model loaded successfully");
}
// Call loadModel when the server starts
loadModel();
// Set up storage and file size limit
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Appending extension
  },
});
const upload = multer({
  limits: { fileSize: 1000000 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed!"), false);
    }
    cb(null, true);
  },
});
app.post("/predict", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ status: "fail", message: "No file uploaded" });
  }
  try {
    const predictionResult = await predictImage(req.file.buffer);
    if (predictionResult.error) {
      throw new Error(predictionResult.error);
    }
    res.send({
      status: "success",
      message: "Model is predicted successfully",
      data: predictionResult.data,
    });
  } catch (predictionError) {
    return res.status(400).send({
      status: "fail",
      message: `Terjadi kesalahan dalam melakukan prediksi`,
    });
  }
});
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      status: "fail",
      message: "Payload content length greater than maximum allowed: 1000000",
    });
  } else if (err.message === "Only image files are allowed!") {
    return res.status(400).json({
      status: "fail",
      message: "Only image files are allowed",
    });
  }
  next(err);
});
// Function to preprocess the image and make a prediction
async function predictImage(image) {
  const inputTensor = tf.node.decodeJpeg(image).resizeNearestNeighbor([224, 224]).expandDims().toFloat();
  const predictions = model.predict(inputTensor);
  const score = await predictions.data();
  const confidenceScore = Math.max(...score) * 100;
  const idP = crypto.randomUUID();
  const label = confidenceScore <= 50 ? "Non-cancer" : "Cancer";
  if (label === "Cancer") {
    return {
      data: {
        id: idP,
        result: "Cancer",
        suggestion: "Segera periksa ke dokter!",
        createdAt: new Date().toISOString(),
      },
    };
  }
  if (label === "Non-cancer") {
    return {
      data: {
        id: idP,
        result: "Non-cancer",
        suggestion: "Penyakit kanker tidak terdeteksi.",
        createdAt: new Date().toISOString(),
      },
    };
  }
}
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});