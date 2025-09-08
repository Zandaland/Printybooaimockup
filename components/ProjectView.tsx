import React, { useState, useEffect, useRef } from 'react';
import type { Project, AspectRatio } from '../types';
import { editMockup, generateVariations } from '../services/geminiService';
import Button from './ui/Button';
import { Download, FilePenLine, Sparkles, Undo2, Redo2, Crop, ChevronDown, Type, Image as ImageIcon, Trash2, ArrowLeft } from 'lucide-react';
import { ASPECT_RATIOS } from '../constants';

interface ProjectViewProps {
  project: Project;
  onProjectUpdate: (updatedProject: Project) => void;
  onBack: () => void;
  onVariationsAdded: (variations: { data: string; mimeType: string; }[]) => void;
}

// Layer Types
interface TextElement {
  id: string;
  content: string;
  color: string;
  size: number;
  fontFamily: string;
  position: { x: number; y: number };
}

interface OverlayElement {
  id: string;
  src: string;
  opacity: number;
  size: { width: number; height: number };
  position: { x: number; y: number };
  imageElement: HTMLImageElement;
}

const FONTS = [
  'Arial', 'Verdana', 'Georgia', 'Times New Roman', 'Courier New', 'Impact', 'Comic Sans MS'
];

type DragType = 'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e';
type ActiveTab = 'edit' | 'variations' | 'tools';

const ProjectView: React.FC<ProjectViewProps> = ({ project, onProjectUpdate, onBack, onVariationsAdded }) => {
  const [history, setHistory] = useState<string[]>([project.generatedImage]);
  const [historyMimeTypes, setHistoryMimeTypes] = useState<string[]>([project.generatedImageMimeType]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const currentImage = history[historyIndex];
  const currentMimeType = historyMimeTypes[historyIndex];

  const [editPrompt, setEditPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Adjustments State
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturate, setSaturate] = useState(100);
  const [sepia, setSepia] = useState(0);
  const [grayscale, setGrayscale] = useState(0);
  const [blur, setBlur] = useState(0);
  const [hueRotate, setHueRotate] = useState(0);
  const [isAdjustmentsOpen, setIsAdjustmentsOpen] = useState(true);
  
  const [isGeneratingVariations, setIsGeneratingVariations] = useState(false);
  const [variationAspectRatio, setVariationAspectRatio] = useState<AspectRatio>('1:1');
  const [styleReferenceFile, setStyleReferenceFile] = useState<File | null>(null);
  const [styleReferencePreview, setStyleReferencePreview] = useState<string>('');
  const [isMasking, setIsMasking] = useState(false);
  const [maskDataUrl, setMaskDataUrl] = useState<string | null>(null);
  const [brushSize, setBrushSize] = useState(40);

  const [activeTab, setActiveTab] = useState<ActiveTab>('edit');

  // Cropping state
  const [isCropping, setIsCropping] = useState(false);
  const [cropBox, setCropBox] = useState({ x: 50, y: 50, width: 200, height: 200 });
  const cropDragInfo = useRef<{ type: DragType, startX: number, startY: number, startBox: typeof cropBox } | null>(null);

  // Layer State
  const [textElements, setTextElements] = useState<TextElement[]>([]);
  const [overlayElements, setOverlayElements] = useState<OverlayElement[]>([]);
  const [selectedElement, setSelectedElement] = useState<{id: string; type: 'text' | 'overlay'} | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const isDrawing = useRef(false);
  const toolDragInfo = useRef<{ startX: number, startY: number, elementStartX: number, elementStartY: number } | null>(null);
  const toolResizeInfo = useRef<{
    startX: number;
    startY: number;
    startSize: { width: number; height: number } | number;
    aspectRatio?: number;
    elementId: string;
    elementType: 'text' | 'overlay';
  } | null>(null);

  const isToolActive = isCropping || isMasking || !!selectedElement;

  useEffect(() => {
    setHistory([project.generatedImage]);
    setHistoryMimeTypes([project.generatedImageMimeType]);
    setHistoryIndex(0);
    setIsCropping(false); 
    setTextElements([]);
    setOverlayElements([]);
    setSelectedElement(null);
    setActiveTab('edit');
  }, [project.id]);
  
  useEffect(() => {
    if (project.generatedImage !== history[historyIndex]) {
        const newHistory = [...history.slice(0, historyIndex + 1), project.generatedImage];
        const newMimeTypes = [...historyMimeTypes.slice(0, historyIndex + 1), project.generatedImageMimeType];
        setHistory(newHistory);
        setHistoryMimeTypes(newMimeTypes);
        setHistoryIndex(newHistory.length - 1);
    }
  }, [project.generatedImage, project.generatedImageMimeType]);

  const handleDownload = () => {
    if (!imageRef.current) return;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = `data:${currentMimeType};base64,${currentImage}`;
    
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setError("Could not create canvas context for download.");
        return;
      }

      // Apply filters
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%) sepia(${sepia}%) grayscale(${grayscale}%) blur(${blur}px) hue-rotate(${hueRotate}deg)`;
      ctx.drawImage(image, 0, 0);
      ctx.filter = 'none';

      // Scaling factors
      if (!imageRef.current) return;
      const scaleX = image.naturalWidth / imageRef.current.width;
      const scaleY = image.naturalHeight / imageRef.current.height;

      // Draw overlays
      overlayElements.forEach(overlay => {
        ctx.globalAlpha = overlay.opacity;
        ctx.drawImage(
            overlay.imageElement,
            overlay.position.x * scaleX,
            overlay.position.y * scaleY,
            overlay.size.width * scaleX,
            overlay.size.height * scaleY
        );
        ctx.globalAlpha = 1.0;
      });

      // Draw text
      textElements.forEach(text => {
        const canvasFontSize = text.size * scaleX;
        ctx.font = `${canvasFontSize}px ${text.fontFamily}`;
        ctx.fillStyle = text.color;
        ctx.textBaseline = 'top';
        const canvasX = text.position.x * scaleX;
        const canvasY = text.position.y * scaleY;
        text.content.split('\n').forEach((line, i) => {
            ctx.fillText(line, canvasX, canvasY + (i * canvasFontSize));
        });
      });

      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `${project.name.replace(/\s+/g, '_')}_edited.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    
    image.onerror = () => { setError("Could not process image for download. Please try again."); }
  };
  
  const handleEdit = async () => {
    if(!editPrompt) return;
    setIsLoading(true);
    setError('');

    let imageCounter = 1;
    const mainImageIndex = imageCounter++;
    const styleImageIndex = styleReferenceFile ? imageCounter++ : 0;
    const maskImageIndex = maskDataUrl ? imageCounter++ : 0;

    const finalPrompt = `
<persona>
You are a precise and expert AI image editor. Your goal is to modify an existing image based on specific instructions, while preserving the quality and integrity of the original.
</persona>

<input_assets>
- Image ${mainImageIndex}: The Main Image. This is the image to be edited.
${styleImageIndex > 0 ? `- Image ${styleImageIndex}: Style Reference. INSTRUCTION: Use this image ONLY to understand the desired artistic style (lighting, mood, color). IGNORE the actual content (objects, people) in this image.\n` : ''}
${maskImageIndex > 0 ? `- Image ${maskImageIndex}: Mask. This is a black and white mask. INSTRUCTION: Apply the edit ONLY to the white areas of this mask. The black areas of the main image MUST remain completely untouched.\n` : ''}
</input_assets>

<edit_task>
- User's primary request: "${editPrompt}"
</edit_task>

<critical_rules>
1.  **PRECISION**: Execute the user's request as precisely as possible.
2.  **PRESERVATION**: Do not change any part of the Main Image that is not related to the edit task. If a mask is provided, the black areas are off-limits.
3.  **SEAMLESS INTEGRATION**: The edit must blend seamlessly with the original image. Maintain consistent lighting, shadows, and perspective.
4.  **MAINTAIN QUALITY**: The output image resolution and quality must be as high as the original. Do not introduce artifacts or blurriness.
</critical_rules>
`;

    try {
        const result = await editMockup(currentImage, currentMimeType, finalPrompt, {
            styleReferenceFile: styleReferenceFile || undefined,
            maskDataBase64: maskDataUrl || undefined,
        });

        const updatedProject = {
            ...project,
            generatedImage: result.image,
            generatedImageMimeType: 'image/png',
            prompt: `${project.prompt}\n\nEDIT: ${finalPrompt}`
        };
        onProjectUpdate(updatedProject);
        setEditPrompt('');
        setMaskDataUrl(null);
        setStyleReferenceFile(null);
        setStyleReferencePreview('');
    } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred during edit.');
    } finally {
        setIsLoading(false);
    }
  };

  const handleGenerateVariations = async () => {
    setIsGeneratingVariations(true);
    setError('');
    try {
        const sourceImage = {
            data: project.sourceImage,
            mimeType: project.sourceImageMimeType
        };
        const results = await generateVariations(sourceImage, project.prompt, 3, variationAspectRatio);
        const newVariations = results.map(r => ({ data: r.image, mimeType: 'image/png' }));
        if (newVariations.length > 0) {
            onVariationsAdded(newVariations);
        } else {
            throw new Error("The AI failed to generate variations. Please try again.");
        }
    } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to generate variations.');
    } finally {
        setIsGeneratingVariations(false);
    }
  };

  const handleSelectVariation = (selectedImage: { data: string, mimeType: string }) => {
    if (selectedImage.data === project.generatedImage) return;
    onProjectUpdate({ 
      ...project, 
      generatedImage: selectedImage.data, 
      generatedImageMimeType: selectedImage.mimeType 
    });
  };

  const handleStyleRefChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        setStyleReferenceFile(file);
        setStyleReferencePreview(URL.createObjectURL(file));
    }
  };

  useEffect(() => {
    if (!isMasking || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!image) return;

    const rect = image.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    const context = canvas.getContext('2d');
    if (!context) return;

    context.strokeStyle = 'white';
    context.lineWidth = brushSize;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    
    const getCoords = (e: MouseEvent | TouchEvent) => {
        if (!imageRef.current) return { x: 0, y: 0 };
        const currentRect = imageRef.current.getBoundingClientRect();
        const event = 'touches' in e ? e.touches[0] : e;
        return { x: event.clientX - currentRect.left, y: event.clientY - currentRect.top };
    }

    const startDrawing = (e: MouseEvent | TouchEvent) => {
        e.preventDefault();
        isDrawing.current = true;
        const { x, y } = getCoords(e);
        context.beginPath();
        context.moveTo(x, y);
    };
    
    const draw = (e: MouseEvent | TouchEvent) => {
        e.preventDefault();
        if (!isDrawing.current) return;
        const { x, y } = getCoords(e);
        context.lineTo(x, y);
        context.stroke();
    };

    const stopDrawing = () => {
        if (!isDrawing.current) return;
        context.closePath();
        isDrawing.current = false;
    };

    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseleave', stopDrawing);

    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', stopDrawing);
    
    return () => {
        canvas.removeEventListener('mousedown', startDrawing);
        canvas.removeEventListener('mousemove', draw);
        canvas.removeEventListener('mouseup', stopDrawing);
        canvas.removeEventListener('mouseleave', stopDrawing);
        canvas.removeEventListener('touchstart', startDrawing);
        canvas.removeEventListener('touchmove', draw);
        canvas.removeEventListener('touchend', stopDrawing);
    };
  }, [isMasking, brushSize]);

  const clearDrawingCanvas = () => {
    if (canvasRef.current) {
        const context = canvasRef.current.getContext('2d');
        if (context) {
            context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    }
  };

  const handleSaveMask = () => {
    if (!canvasRef.current || !imageRef.current) return;
    const originalCanvas = canvasRef.current;
    const image = imageRef.current;
    
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = image.naturalWidth;
    maskCanvas.height = image.naturalHeight;
    const ctx = maskCanvas.getContext('2d');
    
    if (!ctx) {
      setError("Could not create mask context.");
      return;
    }
    
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    
    ctx.drawImage(originalCanvas, 0, 0, maskCanvas.width, maskCanvas.height);

    setMaskDataUrl(maskCanvas.toDataURL('image/png'));
    setIsMasking(false);
    clearDrawingCanvas();
  }

  const handleClearMask = () => {
    clearDrawingCanvas();
    setMaskDataUrl(null);
  }
  
  const handleResetAdjustments = () => { setBrightness(100); setContrast(100); setSaturate(100); setSepia(0); setGrayscale(0); setBlur(0); setHueRotate(0); };
  const handleUndo = () => { if (historyIndex > 0) setHistoryIndex(prev => prev - 1); };
  const handleRedo = () => { if (historyIndex < history.length - 1) setHistoryIndex(prev => prev + 1); };

  const handleCropDragStart = (type: DragType) => (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation(); if (!imageRef.current) return;
    cropDragInfo.current = { type, startX: e.clientX, startY: e.clientY, startBox: { ...cropBox } };
    const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!cropDragInfo.current || !imageRef.current) return;
        const imageBounds = imageRef.current.getBoundingClientRect();
        const dx = moveEvent.clientX - cropDragInfo.current.startX; const dy = moveEvent.clientY - cropDragInfo.current.startY;
        let newBox = { ...cropDragInfo.current.startBox };
        if (cropDragInfo.current.type === 'move') { newBox.x += dx; newBox.y += dy; } else {
            if (cropDragInfo.current.type.includes('w')) { newBox.x += dx; newBox.width -= dx; }
            if (cropDragInfo.current.type.includes('e')) { newBox.width += dx; }
            if (cropDragInfo.current.type.includes('n')) { newBox.y += dy; newBox.height -= dy; }
            if (cropDragInfo.current.type.includes('s')) { newBox.height += dy; }
        }
        newBox.x = Math.max(0, newBox.x); newBox.y = Math.max(0, newBox.y);
        if (newBox.x + newBox.width > imageBounds.width) { newBox.width = imageBounds.width - newBox.x; }
        if (newBox.y + newBox.height > imageBounds.height) { newBox.height = imageBounds.height - newBox.y; }
        newBox.width = Math.max(20, newBox.width); newBox.height = Math.max(20, newBox.height);
        setCropBox(newBox);
    };
    const handleMouseUp = () => { document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); cropDragInfo.current = null; };
    document.addEventListener('mousemove', handleMouseMove); document.addEventListener('mouseup', handleMouseUp);
  };
  
  const applyDestructiveChanges = (drawCallback: (ctx: CanvasRenderingContext2D, scaleX: number, scaleY: number) => void) => {
    if (!imageRef.current) return;
    setIsLoading(true);
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.src = `data:${currentMimeType};base64,${currentImage}`;
    image.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) { setError("Failed to create canvas context."); setIsLoading(false); return; }
        ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%) sepia(${sepia}%) grayscale(${grayscale}%) blur(${blur}px) hue-rotate(${hueRotate}deg)`;
        ctx.drawImage(image, 0, 0);
        ctx.filter = 'none';
        if (imageRef.current) {
            const scaleX = image.naturalWidth / imageRef.current.width;
            const scaleY = image.naturalHeight / imageRef.current.height;
            drawCallback(ctx, scaleX, scaleY);
        }
        const newImageBase64 = canvas.toDataURL('image/png').split(',')[1];
        onProjectUpdate({ ...project, generatedImage: newImageBase64, generatedImageMimeType: 'image/png' });
        handleResetAdjustments(); setIsLoading(false);
    };
    image.onerror = () => { setError("Failed to load image for applying changes."); setIsLoading(false); }
  };

  const handleApplyCrop = () => {
    if (!imageRef.current) return;
    applyDestructiveChanges((ctx, scaleX, scaleY) => {
        const sourceX = cropBox.x * scaleX; const sourceY = cropBox.y * scaleY;
        const sourceWidth = cropBox.width * scaleX; const sourceHeight = cropBox.height * scaleY;
        if (sourceWidth <= 0 || sourceHeight <= 0) return;
        const croppedImageData = ctx.getImageData(sourceX, sourceY, sourceWidth, sourceHeight);
        ctx.canvas.width = sourceWidth; ctx.canvas.height = sourceHeight;
        ctx.putImageData(croppedImageData, 0, 0);
    });
    setIsCropping(false);
  };
  
  const handleAddText = () => {
    const newId = `text_${Date.now()}`;
    const newTextElement: TextElement = {
        id: newId,
        content: 'Your Text Here',
        color: '#18181B',
        size: 40,
        fontFamily: FONTS[0],
        position: { x: 50, y: 50 },
    };
    setTextElements(prev => [...prev, newTextElement]);
    setSelectedElement({ id: newId, type: 'text' });
    activateTool(null);
  }

  const handleUpdateTextElement = (id: string, newProps: Partial<TextElement>) => {
    setTextElements(prev => prev.map(el => el.id === id ? { ...el, ...newProps } : el));
  }
  
  const handleUpdateOverlayElement = (id: string, newProps: Partial<OverlayElement>) => {
    setOverlayElements(prev => prev.map(el => el.id === id ? { ...el, ...newProps } : el));
  }
  
  const handleDeleteElement = () => {
    if (!selectedElement) return;
    if (selectedElement.type === 'text') {
        setTextElements(prev => prev.filter(el => el.id !== selectedElement.id));
    } else {
        setOverlayElements(prev => prev.filter(el => el.id !== selectedElement.id));
    }
    setSelectedElement(null);
  }

  const handleOverlayFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const initialWidth = imageRef.current ? imageRef.current.width * 0.3 : 150;
                const aspectRatio = img.naturalWidth / img.naturalHeight;
                const newId = `overlay_${Date.now()}`;
                const newOverlay: OverlayElement = {
                    id: newId,
                    src: img.src, imageElement: img, opacity: 1,
                    size: { width: initialWidth, height: initialWidth / aspectRatio },
                    position: { x: 50, y: 50 },
                };
                setOverlayElements(prev => [...prev, newOverlay]);
                setSelectedElement({id: newId, type: 'overlay'});
                activateTool(null);
            };
            img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
        e.target.value = ''; // Reset file input
    }
  };

  const handleToolDragStart = (e: React.MouseEvent, id: string, type: 'text' | 'overlay') => {
    e.preventDefault(); e.stopPropagation(); 
    const element = e.currentTarget as HTMLDivElement;
    toolDragInfo.current = { startX: e.clientX, startY: e.clientY, elementStartX: element.offsetLeft, elementStartY: element.offsetTop };
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!toolDragInfo.current || !imageRef.current) return;
        const dx = moveEvent.clientX - toolDragInfo.current.startX; const dy = moveEvent.clientY - toolDragInfo.current.startY;
        const newX = toolDragInfo.current.elementStartX + dx; const newY = toolDragInfo.current.elementStartY + dy;
        const imageRect = imageRef.current.getBoundingClientRect(); const elementRect = element.getBoundingClientRect();
        const constrainedX = Math.max(0, Math.min(newX, imageRect.width - elementRect.width));
        const constrainedY = Math.max(0, Math.min(newY, imageRect.height - elementRect.height));
        const newPosition = { x: constrainedX, y: constrainedY };

        if (type === 'text') {
            handleUpdateTextElement(id, { position: newPosition });
        } else {
            handleUpdateOverlayElement(id, { position: newPosition });
        }
    };
    const handleMouseUp = () => { document.removeEventListener('mousemove', handleMouseMove); document.removeEventListener('mouseup', handleMouseUp); toolDragInfo.current = null; };
    document.addEventListener('mousemove', handleMouseMove); document.addEventListener('mouseup', handleMouseUp);
  };
  
  const handleToolResizeStart = (
    e: React.MouseEvent,
    id: string,
    type: 'text' | 'overlay'
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const element = (type === 'text'
        ? textElements.find(el => el.id === id)
        : overlayElements.find(el => el.id === id));

    if (!element) return;

    toolResizeInfo.current = {
        startX: e.clientX,
        startY: e.clientY,
        startSize: type === 'text' ? (element as TextElement).size : (element as OverlayElement).size,
        aspectRatio: type === 'overlay' ? (element as OverlayElement).size.width / (element as OverlayElement).size.height : undefined,
        elementId: id,
        elementType: type
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!toolResizeInfo.current) return;
        const { startX, startSize, aspectRatio, elementId, elementType } = toolResizeInfo.current;
        const dx = moveEvent.clientX - startX;
        
        if (elementType === 'text') {
            const currentSize = startSize as number;
            const newSize = Math.max(8, Math.min(200, currentSize + dx * 0.5));
            handleUpdateTextElement(elementId, { size: newSize });
        } else { // overlay
            const currentSize = startSize as { width: number, height: number };
            const newWidth = Math.max(20, currentSize.width + dx);
            const newHeight = aspectRatio ? newWidth / aspectRatio : currentSize.height;
            handleUpdateOverlayElement(elementId, { size: { width: newWidth, height: newHeight } });
        }
    };

    const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        toolResizeInfo.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const activateTool = (tool: 'crop' | 'mask' | null) => {
    if (isMasking && tool !== 'mask') {
      clearDrawingCanvas();
    }
    
    setIsCropping(tool === 'crop');
    setIsMasking(tool === 'mask');
    if (tool) setSelectedElement(null);

    if (tool === 'crop' && imageRef.current) {
        const rect = imageRef.current.getBoundingClientRect();
        setCropBox({ x: rect.width * 0.2, y: rect.height * 0.2, width: rect.width * 0.6, height: rect.height * 0.6 });
    }
  };

  const resizerHandles: DragType[] = ['nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e'];
  
  const mainProjectImage = { data: project.generatedImage, mimeType: project.generatedImageMimeType };
  const allSelectableImages = [mainProjectImage, ...(project.variations || [])];
  const uniqueSelectableImages = Array.from(new Map(allSelectableImages.map(item => [item.data, item])).values());


  const getSelectedTextElement = () => selectedElement?.type === 'text' ? textElements.find(el => el.id === selectedElement.id) : null;
  const getSelectedOverlayElement = () => selectedElement?.type === 'overlay' ? overlayElements.find(el => el.id === selectedElement.id) : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
      <div className="lg:col-span-2 relative">
        {isLoading && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-none z-30">
                <div className="flex justify-center items-center">
                    <svg className="animate-spin mr-3 h-8 w-8 text-zinc-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-xl">Updating Mockup...</span>
                </div>
            </div>
        )}
        <div ref={imageContainerRef} className="relative" onClick={(e) => { if(e.target === imageContainerRef.current || e.target === imageRef.current) setSelectedElement(null) }}>
            <img ref={imageRef} src={`data:${currentMimeType};base64,${currentImage}`} alt={project.name} className="w-full h-auto object-contain rounded-none border-2 border-zinc-900"
              style={{ filter: `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturate}%) sepia(${sepia}%) grayscale(${grayscale}%) blur(${blur}px) hue-rotate(${hueRotate}deg)` }}
              onLoad={() => { if (isCropping) activateTool('crop')}} />
            
            {/* Render Layers */}
            {textElements.map(el => (
              <div 
                key={el.id}
                onMouseDown={(e) => handleToolDragStart(e, el.id, 'text')}
                onClick={(e) => { e.stopPropagation(); setSelectedElement({id: el.id, type: 'text'})}}
                style={{
                  position: 'absolute', left: el.position.x, top: el.position.y,
                  color: el.color, fontSize: el.size, fontFamily: el.fontFamily,
                  cursor: 'move', userSelect: 'none', whiteSpace: 'pre',
                  textShadow: '0 0 5px white', zIndex: 25,
                  border: selectedElement?.id === el.id ? '2px dashed #18181B' : 'none',
                  padding: '2px'
                }}
              >
                  {el.content}
                  {selectedElement?.id === el.id && (
                    <div
                        onMouseDown={(e) => handleToolResizeStart(e, el.id, 'text')}
                        className="absolute -bottom-1 -right-1 w-4 h-4 bg-lime-400 border-2 border-zinc-900 rounded-none cursor-nwse-resize z-30"
                        title="Resize Text"
                    />
                  )}
              </div>
            ))}
            {overlayElements.map(el => (
              <div
                key={el.id}
                onMouseDown={(e) => handleToolDragStart(e, el.id, 'overlay')}
                onClick={(e) => { e.stopPropagation(); setSelectedElement({id: el.id, type: 'overlay'})}}
                style={{
                  position: 'absolute', left: el.position.x, top: el.position.y,
                  width: el.size.width, height: el.size.height,
                  cursor: 'move', zIndex: 25,
                  border: selectedElement?.id === el.id ? '2px dashed #18181B' : 'none',
                }}
              >
                <img src={el.src} style={{ opacity: el.opacity, width: '100%', height: '100%' }} alt="Overlay" draggable="false" />
                {selectedElement?.id === el.id && (
                    <div
                        onMouseDown={(e) => handleToolResizeStart(e, el.id, 'overlay')}
                        className="absolute -bottom-1 -right-1 w-4 h-4 bg-lime-400 border-2 border-zinc-900 rounded-none cursor-nwse-resize z-30"
                        title="Resize Overlay"
                    />
                )}
              </div>
            ))}

            {isMasking && <canvas ref={canvasRef} className="absolute top-0 left-0 z-20 cursor-crosshair opacity-50" />}
            {isCropping && (
                <div className="absolute top-0 left-0 w-full h-full z-10">
                    <div className="absolute border-2 border-dashed border-zinc-900 cursor-move" style={{ top: cropBox.y, left: cropBox.x, width: cropBox.width, height: cropBox.height, boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.7)' }} onMouseDown={handleCropDragStart('move')}>
                        {resizerHandles.map(handle => (
                            <div key={handle} onMouseDown={handleCropDragStart(handle)} className={`absolute bg-zinc-900 w-3 h-3 -m-1.5 
                                ${handle.includes('n') ? 'top-0' : ''} ${handle.includes('s') ? 'bottom-0' : ''} ${handle.includes('w') ? 'left-0' : ''} ${handle.includes('e') ? 'right-0' : ''}
                                ${(handle === 'n' || handle === 's') ? 'left-1/2 -translate-x-1/2' : ''} ${(handle === 'w' || handle === 'e') ? 'top-1/2 -translate-y-1/2' : ''}
                                cursor-${handle}-resize`}>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
      </div>

      <div>
        <Button onClick={onBack} variant="secondary" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Studio
        </Button>
        <div className="pb-4"><h2 className="text-3xl font-bold">{project.name}</h2>
            <div className="flex items-center gap-2 mt-4"><span className="text-sm font-semibold text-stone-600">HISTORY:</span>
                <Button onClick={handleUndo} disabled={historyIndex <= 0} variant="secondary" size="sm" aria-label="Undo" isIconOnly> <Undo2 className="w-5 h-5" /> </Button>
                <Button onClick={handleRedo} disabled={historyIndex >= history.length - 1} variant="secondary" size="sm" aria-label="Redo" isIconOnly> <Redo2 className="w-5 h-5" /> </Button>
            </div>
        </div>

        <div className="border-b-2 border-zinc-900 mt-4">
            <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                <button onClick={() => setActiveTab('edit')} className={`group inline-flex items-center py-3 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${ activeTab === 'edit' ? 'border-lime-400 text-zinc-900' : 'border-transparent text-stone-600 hover:text-zinc-900 hover:border-stone-400' }`}><FilePenLine className="mr-2 h-5 w-5" /> <span>AI Edit & Adjust</span></button>
                <button onClick={() => setActiveTab('variations')} className={`group inline-flex items-center py-3 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${ activeTab === 'variations' ? 'border-lime-400 text-zinc-900' : 'border-transparent text-stone-600 hover:text-zinc-900 hover:border-stone-400' }`}><Sparkles className="mr-2 h-5 w-5" /> <span>Variations</span></button>
                <button onClick={() => setActiveTab('tools')} className={`group inline-flex items-center py-3 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${ activeTab === 'tools' ? 'border-lime-400 text-zinc-900' : 'border-transparent text-stone-600 hover:text-zinc-900 hover:border-stone-400' }`}><Crop className="mr-2 h-5 w-5" /> <span>Tools</span></button>
            </nav>
        </div>
        
        <div className="py-6">
            {activeTab === 'edit' && (<div className="space-y-6">
              {isMasking ? (
                  <div><h3 className="text-lg font-semibold mb-3">Masking Tool</h3>
                      <div className="space-y-4 p-4 bg-white rounded-none border-2 border-zinc-900"><label className="block"><span className="text-stone-600">Brush Size ({brushSize}px)</span><input type="range" min="10" max="100" value={brushSize} onChange={e => setBrushSize(Number(e.target.value))} className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer" /></label>
                          <div className="flex gap-2"><Button onClick={handleSaveMask} className="w-full">Save Mask</Button><Button onClick={handleClearMask} variant="secondary" className="w-full">Clear</Button><Button onClick={() => { activateTool(null); clearDrawingCanvas(); }} variant="outline" className="w-full">Cancel</Button></div>
                      </div>
                  </div>
              ) : ( <>
                <div><h3 className="text-lg font-semibold mb-3 flex items-center"><FilePenLine className="w-5 h-5 mr-2 text-lime-500" />AI Edit</h3>
                    <div className="space-y-4"><textarea value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} placeholder="e.g., 'change the background to a beach at sunset'" className="w-full h-24 p-2 bg-white border-2 border-zinc-900 rounded-none focus:outline-none focus:border-lime-400" disabled={isLoading} />
                        <div className="flex gap-4 items-center"><label htmlFor="style-ref-upload" className="flex-1 cursor-pointer text-center px-4 py-2 text-sm font-medium text-zinc-900 bg-white rounded-none hover:bg-stone-100 transition border-2 border-zinc-900">{styleReferenceFile ? 'Change Style Ref' : 'Upload Style Ref'}</label><input id="style-ref-upload" type="file" className="hidden" accept="image/*" onChange={handleStyleRefChange} />{styleReferencePreview && <img src={styleReferencePreview} alt="style preview" className="w-10 h-10 rounded-none object-cover border-2 border-zinc-900" />}</div>
                        <div className="flex gap-4 items-center"><Button onClick={() => activateTool('mask')} variant="secondary" className="flex-1" disabled={isToolActive}>Create Mask</Button>{maskDataUrl && <img src={maskDataUrl} alt="mask preview" className="w-10 h-10 rounded-none object-cover bg-white border-2 border-zinc-900" />}{maskDataUrl && <Button onClick={handleClearMask} variant="outline" size="sm">Clear</Button>}</div>
                        <Button onClick={handleEdit} isLoading={isLoading} disabled={!editPrompt} className="w-full mt-2">Update Mockup</Button>
                    </div>{error && <p className="text-red-500 text-sm mt-2 text-center">{error}</p>}
                </div>
                <div>
                    <button onClick={() => setIsAdjustmentsOpen(!isAdjustmentsOpen)} className="w-full flex justify-between items-center py-2"><h3 className="text-lg font-semibold">Adjustments</h3><ChevronDown className={`w-5 h-5 transition-transform ${isAdjustmentsOpen ? 'rotate-180' : ''}`} /></button>
                    {isAdjustmentsOpen && (<div className="space-y-4 pt-2">
                        <label className="block"><span className="text-stone-600">Brightness ({brightness}%)</span><input type="range" min="50" max="150" value={brightness} onChange={e => setBrightness(Number(e.target.value))} className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer" /></label>
                        <label className="block"><span className="text-stone-600">Contrast ({contrast}%)</span><input type="range" min="50" max="150" value={contrast} onChange={e => setContrast(Number(e.target.value))} className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer" /></label>
                        <label className="block"><span className="text-stone-600">Saturation ({saturate}%)</span><input type="range" min="0" max="200" value={saturate} onChange={e => setSaturate(Number(e.target.value))} className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer" /></label>
                        <label className="block"><span className="text-stone-600">Sepia ({sepia}%)</span><input type="range" min="0" max="100" value={sepia} onChange={e => setSepia(Number(e.target.value))} className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer" /></label>
                        <label className="block"><span className="text-stone-600">Grayscale ({grayscale}%)</span><input type="range" min="0" max="100" value={grayscale} onChange={e => setGrayscale(Number(e.target.value))} className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer" /></label>
                        <label className="block"><span className="text-stone-600">Blur ({blur}px)</span><input type="range" min="0" max="20" value={blur} onChange={e => setBlur(Number(e.target.value))} className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer" /></label>
                        <label className="block"><span className="text-stone-600">Hue ({hueRotate}°)</span><input type="range" min="0" max="360" value={hueRotate} onChange={e => setHueRotate(Number(e.target.value))} className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer" /></label>
                        <Button onClick={handleResetAdjustments} variant="outline" size="sm" className="w-full">Reset All</Button>
                    </div>)}
                </div> </>
              )}
            </div>)}
            {activeTab === 'variations' && (<div className="p-4 bg-white rounded-none border-2 border-zinc-900"><h3 className="text-lg font-semibold mb-3">Variations</h3><div className="grid grid-cols-4 gap-2 mb-4">
                {uniqueSelectableImages.map((img, index) => (<img key={index} src={`data:${img.mimeType};base64,${img.data}`} alt={`Variation ${index + 1}`} onClick={() => handleSelectVariation(img)} className={`w-full aspect-square object-cover rounded-none cursor-pointer border-2 transition-all ${project.generatedImage === img.data ? 'border-lime-400 scale-105' : 'border-transparent hover:border-zinc-900'}`} />))}
            </div>
            <div className="mb-4">
                <label className="block text-sm font-medium text-stone-600 mb-2">Aspect Ratio for New Variations</label>
                <div className="flex flex-wrap gap-2">
                    {ASPECT_RATIOS.map(ar => (
                        <button key={ar} onClick={() => setVariationAspectRatio(ar)} className={`px-3 py-1.5 rounded-none text-xs font-medium transition border-2 border-zinc-900 ${variationAspectRatio === ar ? 'bg-lime-400 text-zinc-900' : 'bg-white text-stone-600 hover:bg-stone-100'}`}>
                            {ar}
                        </button>
                    ))}
                </div>
            </div>
            <Button onClick={handleGenerateVariations} variant="secondary" className="w-full" isLoading={isGeneratingVariations}><Sparkles className="w-5 h-5 mr-2" /><span>{isGeneratingVariations ? 'Generating...' : 'Generate 3 More'}</span></Button></div>)}
            {activeTab === 'tools' && (<div className="space-y-6">
                
                {/* --- NO ELEMENT SELECTED --- */}
                {!selectedElement && (
                  <>
                    <div className="p-4 bg-white rounded-none border-2 border-zinc-900">
                        {isCropping ? (<div><h3 className="text-lg font-semibold mb-3">Crop Image</h3><p className="text-sm text-stone-600 mb-4">Drag the box or its handles to select an area to crop.</p><div className="flex gap-2"><Button onClick={handleApplyCrop} className="w-full">Apply Crop</Button><Button onClick={() => activateTool(null)} variant="outline" className="w-full">Cancel</Button></div></div>) 
                        : (<div><h3 className="text-lg font-semibold mb-3">Crop Tool</h3><p className="text-sm text-stone-600 mb-4">Select a portion of the image. This is a destructive action.</p><Button onClick={() => activateTool('crop')} variant="secondary" className="w-full" disabled={isToolActive}><Crop className="w-5 h-5 mr-2" /><span>Activate Crop Mode</span></Button></div>)}
                    </div>
                    <div className="p-4 bg-white rounded-none border-2 border-zinc-900">
                      <h3 className="text-lg font-semibold mb-3">Text Tool</h3><p className="text-sm text-stone-600 mb-4">Add a text overlay to the image.</p><Button onClick={handleAddText} variant="secondary" className="w-full" disabled={isCropping || isMasking}><Type className="w-5 h-5 mr-2" /><span>Add Text</span></Button>
                    </div>
                    <div className="p-4 bg-white rounded-none border-2 border-zinc-900">
                      <h3 className="text-lg font-semibold mb-3">Overlay Tool</h3><p className="text-sm text-stone-600 mb-4">Add a logo or watermark to the image.</p><Button onClick={() => document.getElementById('overlay-upload')?.click()} variant="secondary" className="w-full" disabled={isCropping || isMasking}><ImageIcon className="w-5 h-5 mr-2" /><span>Add Image Overlay</span></Button><input id="overlay-upload" type="file" className="hidden" accept="image/*" onChange={handleOverlayFileChange} />
                    </div>
                  </>
                )}
                
                {/* --- TEXT ELEMENT SELECTED --- */}
                {getSelectedTextElement() && (
                  <div className="p-4 bg-white rounded-none border-2 border-zinc-900">
                    <h3 className="text-lg font-semibold mb-3">Edit Text</h3>
                    <div className="space-y-4">
                      <textarea value={getSelectedTextElement()!.content} onChange={e => handleUpdateTextElement(selectedElement!.id, { content: e.target.value })} className="w-full h-20 p-2 bg-white border-2 border-zinc-900 rounded-none focus:outline-none focus:border-lime-400" placeholder="Your text here..."/>
                      <div className="flex items-center justify-between gap-4">
                        <label className="text-stone-600">Font:</label>
                        <select value={getSelectedTextElement()!.fontFamily} onChange={e => handleUpdateTextElement(selectedElement!.id, { fontFamily: e.target.value })} className="flex-1 p-2 bg-white border-2 border-zinc-900 rounded-none">
                          {FONTS.map(font => <option key={font} value={font}>{font}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="text-stone-600">Color:</label><input type="color" value={getSelectedTextElement()!.color} onChange={e => handleUpdateTextElement(selectedElement!.id, { color: e.target.value })} className="w-8 h-8 p-0 border-none bg-transparent cursor-pointer" />
                      </div>
                      <label className="block"><span className="text-stone-600">Size ({getSelectedTextElement()!.size}px)</span><input type="range" min="10" max="150" value={getSelectedTextElement()!.size} onChange={e => handleUpdateTextElement(selectedElement!.id, { size: Number(e.target.value) })} className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer" /></label>
                      <div className="flex gap-2"><Button onClick={() => setSelectedElement(null)} variant="secondary" className="w-full">Done</Button><Button onClick={handleDeleteElement} variant="outline" className="w-full"><Trash2 className="w-4 h-4 mr-2"/>Delete</Button></div>
                    </div>
                  </div>
                )}
                
                {/* --- OVERLAY ELEMENT SELECTED --- */}
                {getSelectedOverlayElement() && (
                  <div className="p-4 bg-white rounded-none border-2 border-zinc-900">
                    <h3 className="text-lg font-semibold mb-3">Edit Image Overlay</h3>
                    <div className="space-y-4">
                      <label className="block"><span className="text-stone-600">Opacity ({Math.round(getSelectedOverlayElement()!.opacity * 100)}%)</span><input type="range" min="0.1" max="1" step="0.1" value={getSelectedOverlayElement()!.opacity} onChange={e => handleUpdateOverlayElement(selectedElement!.id, { opacity: Number(e.target.value) })} className="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer" /></label>
                      <div className="flex gap-2"><Button onClick={() => setSelectedElement(null)} variant="secondary" className="w-full">Done</Button><Button onClick={handleDeleteElement} variant="outline" className="w-full"><Trash2 className="w-4 h-4 mr-2"/>Delete</Button></div>
                    </div>
                  </div>
                )}

            </div>)}
        </div>
        
        <div className="pt-6 mt-4 border-t-2 border-zinc-900">
            <Button onClick={handleDownload} variant="primary" className="w-full"><Download className="w-5 h-5 mr-2" /><span>Download Final Image</span></Button>
        </div>
      </div>
    </div>
  );
};

export default ProjectView;