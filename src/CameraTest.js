import { useState, useEffect, useRef } from "react";

const CameraTest = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [photo, setPhoto] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { video: false },
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
      const videoElement = videoRef.current;
      if (videoElement && videoElement.srcObject) {
        videoElement.srcObject.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d").drawImage(video, 0, 0);
      const photoData = canvas.toDataURL("image/jpeg");
      setPhoto(photoData);
      video.srcObject.getTracks().forEach((track) => track.stop());
    }
  };

  return (
    <div className="flex flex-col items-center p-4 bg-gray-100 min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Camera Access</h1>
      {error && <div className="text-red-500 mb-4">{error}</div>}
      {!photo ? (
        <video
          ref={videoRef}
          autoPlay
          className="w-full max-w-md rounded-lg shadow-lg"
        ></video>
      ) : (
        <img
          src={photo}
          alt="Captured photo"
          className="w-full max-w-md rounded-lg shadow-lg"
        />
      )}
      <button
        onClick={capturePhoto}
        className="mt-4 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
      >
        Capture Photo
      </button>
      <canvas ref={canvasRef} className="hidden"></canvas>
    </div>
  );
};
export default CameraTest;
