import React, { useState, useRef } from "react";
import Webcam from "react-webcam";

function CameraApp({ onCapture }) {
  const [photoSrc, setPhotoSrc] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [webcamReady, setWebcamReady] = useState(false);
  const [error, setError] = useState("");
  const webcamRef = useRef(null);

  const handleUserMedia = () => {
    setWebcamReady(true);
    setError("");
  };

  const handleUserMediaError = (err) => {
    setError(
      <span>
        Camera access denied or not available.
        <br />
        <ul className="list-disc pl-5 mt-2 text-left">
          <li>
            Make sure you are using <b>HTTPS</b> or <b>localhost</b> in your
            browser address bar.
          </li>
          <li>
            Use the latest version of <b>Chrome</b> or a Chromium-based browser
            on Android.
          </li>
          <li>
            When prompted, <b>allow camera access</b> for this site.
          </li>
          <li>If you denied access, refresh and allow permissions.</li>
        </ul>
      </span>
    );
    setWebcamReady(false);
  };

  const capturePhoto = () => {
    if (!webcamRef.current) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      setError("Camera not ready. Please wait and try again.");
      return;
    }
    // Create an image to crop
    const img = new window.Image();
    img.onload = () => {
      // Desired aspect ratio: 12:22 (width:height)
      const aspectW = 12;
      const aspectH = 22;
      const aspectRatio = aspectW / aspectH;
      let cropWidth = img.width;
      let cropHeight = img.height;
      if (img.width / img.height > aspectRatio) {
        cropWidth = img.height * aspectRatio;
      } else {
        cropHeight = img.width / aspectRatio;
      }
      const cropX = (img.width - cropWidth) / 2;
      const cropY = (img.height - cropHeight) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = cropWidth;
      canvas.height = cropHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(
        img,
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
        // Optionally convert to File if needed by processCameraImage
        const file = new File([photoBlob], `capture-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        onCapture(file);
      }
      setPhotoSrc(canvas.toDataURL("image/jpeg"));
      setCameraActive(false);
      setWebcamReady(false);
    };
    img.src = imageSrc;
  };

  const retakePhoto = () => {
    setPhotoSrc(null);
    setCameraActive(true);
    setWebcamReady(false);
    setError("");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <h1 className="text-2xl font-bold mb-4">Camera App</h1>
      {error && <div className="mb-2 text-red-600 font-semibold">{error}</div>}
      {!cameraActive && !photoSrc && (
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition cursor-pointer"
          onClick={() => {
            setCameraActive(true);
            setError("");
          }}
        >
          Start Camera
        </button>
      )}
      {cameraActive && !photoSrc && (
        <div className="flex flex-col items-center">
          <div
            className="mt-4 w-full max-w-sm rounded-lg overflow-hidden"
            style={{
              aspectRatio: "12 / 22",
              background: "#222",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Webcam
              ref={webcamRef}
              audio={false}
              screenshotFormat="image/jpeg"
              videoConstraints={{ facingMode: "environment" }}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                aspectRatio: "12 / 22",
              }}
              onUserMedia={handleUserMedia}
              onUserMediaError={handleUserMediaError}
            />
            {!webcamReady && (
              <div className="absolute text-white bg-black bg-opacity-60 px-4 py-2 rounded">
                Loading camera...
              </div>
            )}
          </div>
          <button
            onClick={capturePhoto}
            className={`mt-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition ${
              !webcamReady ? "opacity-50 cursor-not-allowed" : ""
            }`}
            disabled={!webcamReady}
          >
            Capture
          </button>
          <button
            onClick={() => {
              setCameraActive(false);
              setError("");
            }}
            className="mt-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
          >
            Cancel
          </button>
        </div>
      )}
      {photoSrc && (
        <>
          <div
            className="mt-4 w-full max-w-sm rounded-lg overflow-hidden"
            style={{
              aspectRatio: "12 / 22",
              background: "#eee",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={photoSrc}
              alt="Captured"
              className="w-full h-full object-cover"
              style={{ aspectRatio: "12 / 22" }}
            />
          </div>
          <button
            onClick={retakePhoto}
            className="mt-2 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
          >
            Retake Photo
          </button>
        </>
      )}
    </div>
  );
}

export default CameraApp;

function dataURLtoBlob(dataURL) {
  const byteString = atob(dataURL.split(",")[1]);
  const mimeString = dataURL.split(",")[0].split(":")[1].split(";")[0];
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mimeString });
}
