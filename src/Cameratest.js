import { useState, useEffect, useRef } from "react";
import "./App.css";
function dataURLtoBlob(dataurl) {
  const arr = dataurl.split(",");
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}
const CameraTest = ({ onCapture }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("Error accessing camera:", err);
        setError("Failed to access camera: " + err.message);
      }
    }
    startCamera();
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Calculate crop dimensions for 12/22 aspect ratio
      const targetRatio = 12 / 22;
      let cropWidth = video.videoWidth;
      let cropHeight = Math.round(cropWidth / targetRatio);
      if (cropHeight > video.videoHeight) {
        cropHeight = video.videoHeight;
        cropWidth = Math.round(cropHeight * targetRatio);
      }
      const cropX = Math.floor((video.videoWidth - cropWidth) / 2);
      const cropY = Math.floor((video.videoHeight - cropHeight) / 2);

      // Set canvas to crop size
      canvas.width = cropWidth;
      canvas.height = cropHeight;

      // Draw the cropped area from the video to the canvas
      canvas
        .getContext("2d")
        .drawImage(
          video,
          cropX,
          cropY,
          cropWidth,
          cropHeight,
          0,
          0,
          cropWidth,
          cropHeight
        );

      const photoData = canvas.toDataURL("image/jpeg");
      const photoBlob = dataURLtoBlob(photoData);
      if (onCapture) {
        onCapture(photoBlob);
      }
      video.srcObject.getTracks().forEach((track) => track.stop());
    }
  };

  return (
    <div className="flex flex-col items-center  bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Camera Access</h1>
      {error && <div className="text-red-500 mb-4">{error}</div>}
      <div className="camera-preview-container">
        <video ref={videoRef} autoPlay playsInline />
      </div>
      <button onClick={capturePhoto} className="action-button btn-primary">
        Capture Photo
      </button>
      <canvas ref={canvasRef} className="hidden"></canvas>
      <style>
        {`
        .camera-video-container {
  position: relative;
  width: 90vw;
  max-width: 400px;
  aspect-ratio: 12 / 22;
  margin: auto;
  background: #222;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.camera-video-container video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: #222;
  border-radius: 12px;
}`}
      </style>
    </div>
  );
};
export default CameraTest;
