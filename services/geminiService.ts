import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const fileToBase64 = (file: File): Promise<{mimeType: string, data: string}> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      const mimeType = result.split(';')[0].split(':')[1];
      const data = result.split(',')[1];
      resolve({ mimeType, data });
    };
    reader.onerror = error => reject(error);
  });
};

export const createThumbnail = (
  imageBase64: string,
  mimeType: string = 'image/png',
  maxWidth: number = 400,
  quality: number = 0.7
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = `data:${mimeType};base64,${imageBase64}`;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Could not get canvas context'));
      }

      const ratio = img.width / img.height;
      const width = Math.min(img.width, maxWidth);
      const height = width / ratio;

      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(img, 0, 0, width, height);
      
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(dataUrl);
    };
    img.onerror = (error) => {
      reject(error);
    };
  });
};

export const resizeImage = (
  imageBase64: string,
  mimeType: string,
  maxWidth: number = 1280,
): Promise<{ data: string, mimeType: string }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = `data:${mimeType};base64,${imageBase64}`;
    img.onload = () => {
      // If the image is already a PNG and within the size limit, no need to re-process.
      // This avoids any potential quality loss from re-rendering on a canvas.
      if (img.width <= maxWidth && mimeType === 'image/png') {
        resolve({ data: imageBase64, mimeType: 'image/png' });
        return;
      }
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Could not get canvas context'));
      }

      const ratio = img.width / img.height;
      const width = Math.min(img.width, maxWidth);
      const height = width / ratio;

      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(img, 0, 0, width, height);
      
      // Always output as PNG to preserve quality and avoid compression artifacts.
      const dataUrl = canvas.toDataURL('image/png');
      const data = dataUrl.split(',')[1];
      resolve({ data, mimeType: 'image/png' });
    };
    img.onerror = (error) => {
      reject(error);
    };
  });
};


export const createBlankCanvas = (
  aspectRatio: string,
  width: number = 512,
  color: string = '#808080'
): { mimeType: string; data: string } => {
  const [w, h] = aspectRatio.split(':').map(Number);
  if (!w || !h) {
    throw new Error(`Invalid aspect ratio format: ${aspectRatio}`);
  }
  const height = Math.round((width * h) / w);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get canvas context for blank canvas');
  }

  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);

  const dataUrl = canvas.toDataURL('image/png');
  const mimeType = 'image/png';
  const data = dataUrl.split(',')[1];
  return { mimeType, data };
};

export const generateMockup = async (
  designFile: File,
  prompt: string,
  options: {
    styleReferenceFile?: File | null;
    modelImageFile?: File | null;
    aspectRatioCanvas?: { mimeType: string, data: string };
  } = {}
): Promise<{ image: string; text: string }> => {
  const { styleReferenceFile, modelImageFile, aspectRatioCanvas } = options;
  const { mimeType: designMimeType, data: base64ImageData } = await fileToBase64(designFile);

  const parts: any[] = [
    {
      inlineData: {
        data: base64ImageData,
        mimeType: designMimeType,
      },
    },
  ];

  // Prioritize model and style images by adding them before the technical canvas image.
  // This helps the model focus on the more important visual references first.
  if (modelImageFile) {
    const { mimeType: modelMimeType, data: modelData } = await fileToBase64(modelImageFile);
    parts.push({
      inlineData: {
        data: modelData,
        mimeType: modelMimeType,
      },
    });
  }

  if (styleReferenceFile) {
    const { mimeType: styleMimeType, data: styleData } = await fileToBase64(styleReferenceFile);
    parts.push({
      inlineData: {
        data: styleData,
        mimeType: styleMimeType,
      },
    });
  }
  
  if (aspectRatioCanvas) {
    parts.push({
      inlineData: {
        data: aspectRatioCanvas.data,
        mimeType: aspectRatioCanvas.mimeType,
      },
    });
  }

  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image-preview',
    contents: { parts },
    config: {
      responseModalities: [Modality.IMAGE, Modality.TEXT],
    },
  });

  return processResponse(response);
};

export const generateVariations = async (
    sourceImage: { mimeType: string, data: string },
    prompt: string,
    numberOfVariations: number = 2,
    aspectRatio?: string
  ): Promise<{ image: string; text: string }[]> => {
    
    const sourceImagePart = {
      inlineData: {
        data: sourceImage.data,
        mimeType: sourceImage.mimeType,
      },
    };
  
    const parts: any[] = [sourceImagePart];
    let finalPrompt = prompt;

    // The original prompt might reference optional style or model images that are not included
    // when generating variations. We must remove all references to these missing assets to avoid
    // confusing the model. This regex finds and removes any line containing "style reference",
    // "model reference", or a reference to Image 3 or higher, which correspond to the optional assets.
    const stripOptionalReferencesRegex = /^.*(style reference|model reference|Image [3-9]).*$\n/gmi;
    finalPrompt = finalPrompt.replace(stripOptionalReferencesRegex, '');

    if (aspectRatio) {
        const aspectRatioCanvas = createBlankCanvas(aspectRatio);
        parts.push({
          inlineData: {
            data: aspectRatioCanvas.data,
            mimeType: aspectRatioCanvas.mimeType,
          },
        });
        // With the new canvas, the image order is [source, canvas], which matches the
        // indices (Image 1, Image 2) in the original prompt. No text replacement is needed for the prompt itself,
        // just the cleanup of optional image references above.
    }
    
    parts.push({ text: finalPrompt });
  
    const generationPromises = Array.from({ length: numberOfVariations }).map(() =>
      ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: {
          parts: parts,
        },
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
      })
    );
  
    const responses = await Promise.all(generationPromises);
    return responses.map(processResponse);
  };

export const editMockup = async (
  base64ExistingImage: string,
  existingImageMimeType: string,
  prompt: string,
  options: {
    styleReferenceFile?: File;
    maskDataBase64?: string;
  } = {}
): Promise<{ image: string, text: string }> => {
    const { styleReferenceFile, maskDataBase64 } = options;

    const imagePart = {
      inlineData: {
        data: base64ExistingImage,
        mimeType: existingImageMimeType,
      },
    };

    const textPart = { text: prompt };
  
    const parts: any[] = [imagePart];
  
    if (styleReferenceFile) {
      const { mimeType, data } = await fileToBase64(styleReferenceFile);
      parts.push({
        inlineData: { data, mimeType },
      });
      console.log('Added style reference part');
    }
  
    if (maskDataBase64) {
      parts.push({
        inlineData: {
          data: maskDataBase64.split(',')[1], // remove data:image/png;base64,
          mimeType: 'image/png'
        }
      });
      console.log('Added mask part');
    }
  
    parts.push(textPart);

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts },
        config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
      });

      return processResponse(response);
}

const processResponse = (response: GenerateContentResponse): { image: string, text: string } => {
    let generatedImage = '';
    let generatedText = '';
  
    if (response.candidates && response.candidates.length > 0 && response.candidates[0].content) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          generatedImage = part.inlineData.data;
        } else if (part.text) {
          generatedText = part.text;
        }
      }
    }
  
    if (!generatedImage) {
      throw new Error("API did not return an image. " + (generatedText || "No additional text provided."));
    }
  
    return { image: generatedImage, text: generatedText };
  }