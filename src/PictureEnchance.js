export const processScannedImage = (imageSource, onImageProcessed, options = {}) => {
  // Default filter values
  const defaultFilters = {
    brightness: 15,
    contrast: 35,
    gamma: 1.4,
    threshold: 140,
    sharpness: 0.5,
    noiseReduction: 0.2,
  };

  // Merge provided options with default filters
  const filters = { ...defaultFilters, ...options.filters };

  const drawImageOnCanvas = (img, canvas, maintainQuality = true) => {
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const maxWidth = maintainQuality ? 1200 : 800;
    const maxHeight = maintainQuality ? 900 : 600;

    let { width, height } = img;

    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      width *= ratio;
      height *= ratio;
    }

    canvas.width = width;
    canvas.height = height;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(img, 0, 0, width, height);
  };

  const applyEnhancedDocumentFilters = (ctx, width, height) => {
    if (!ctx || width <= 0 || height <= 0) return;

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const originalData = new Uint8ClampedArray(data);

    for (let i = 0; i < data.length; i += 4) {
      let r = originalData[i];
      let g = originalData[i + 1];
      let b = originalData[i + 2];

      const gray = 0.299 * r + 0.587 * g + 0.114 * b;

      let processed = Math.pow(gray / 255, 1 / filters.gamma) * 255;
      processed = processed + filters.brightness;
      processed = (processed - 128) * (1 + filters.contrast / 100) + 128;

      if (processed > filters.threshold) {
        processed = Math.min(255, processed + (255 - processed) * 0.3);
      } else {
        processed = Math.max(0, processed * 0.7);
      }

      processed = Math.max(0, Math.min(255, processed));

      data[i] = processed;
      data[i + 1] = processed;
      data[i + 2] = processed;
    }

    ctx.putImageData(imageData, 0, 0);

    if (filters.sharpness > 0) {
      applySharpening(ctx, width, height, filters.sharpness);
    }

    if (filters.noiseReduction > 0) {
      applyNoiseReduction(ctx, width, height, filters.noiseReduction);
    }
  };

  const applySharpening = (ctx, width, height, intensity) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const originalData = new Uint8ClampedArray(data);

    const sharpenKernel = [
      0, -intensity, 0,
      -intensity, 1 + 4 * intensity, -intensity,
      0, -intensity, 0,
    ];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;

        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const pixelIdx = ((y + ky) * width + (x + kx)) * 4;
            sum += originalData[pixelIdx] * sharpenKernel[(ky + 1) * 3 + (kx + 1)];
          }
        }

        sum = Math.max(0, Math.min(255, sum));
        data[idx] = sum;
        data[idx + 1] = sum;
        data[idx + 2] = sum;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  };

  const applyNoiseReduction = (ctx, width, height, intensity) => {
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const originalData = new Uint8ClampedArray(data);

    const radius = Math.ceil(intensity * 2);

    for (let y = radius; y < height - radius; y++) {
      for (let x = radius; x < width - radius; x++) {
        const idx = (y * width + x) * 4;

        let sum = 0;
        let count = 0;

        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const pixelIdx = ((y + dy) * width + (x + dx)) * 4;
            sum += originalData[pixelIdx];
            count++;
          }
        }

        const avg = sum / count;
        const blended = originalData[idx] * (1 - intensity) + avg * intensity;

        data[idx] = blended;
        data[idx + 1] = blended;
        data[idx + 2] = blended;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  };

  // Create a canvas element
  const canvas = document.createElement('canvas');
  const img = new window.Image();

  img.onload = () => {
    drawImageOnCanvas(img, canvas, true);
    applyEnhancedDocumentFilters(canvas.getContext('2d'), canvas.width, canvas.height);

    try {
      const processedDataUrl = canvas.toDataURL('image/png', 1.0);
      onImageProcessed(processedDataUrl);
    } catch (e) {
      onImageProcessed(null);
    }
  };

  if (typeof imageSource === 'string') {
    img.src = imageSource;
  } else if (imageSource instanceof File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target.result;
    };
    reader.readAsDataURL(imageSource);
  }
};