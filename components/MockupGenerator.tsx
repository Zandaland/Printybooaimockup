
import React, { useState } from 'react';
import type { MockupType, AspectRatio, PromptTemplate, Project } from '../types';
import { PRODUCT_TYPES, ASPECT_RATIOS, PROMPT_TEMPLATES_PERSON, PROMPT_TEMPLATES_FLATLAY } from '../constants';
import { generateMockup, fileToBase64, createBlankCanvas } from '../services/geminiService';
import Button from './ui/Button';
import Card from './ui/Card';
import { UploadCloud, X } from 'lucide-react';

interface MockupGeneratorProps {
    onProjectCreated: (project: Omit<Project, 'thumbnailImage' | 'variations'>) => void;
    onCancel: () => void;
}

type UploadType = 'design' | 'product';

// --- Step 1 Component ---
interface Step1Props {
    uploadType: UploadType;
    setUploadType: (type: UploadType) => void;
    sourcePreview: string;
    handleSourceFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}
const Step1: React.FC<Step1Props> = ({ uploadType, setUploadType, sourcePreview, handleSourceFileChange }) => (
    <div>
        <h3 className="text-2xl font-semibold mb-6 text-center">Step 1: Upload Your Source Image</h3>
        <div className="flex justify-center mb-6">
            <div className="p-1 bg-stone-200 rounded-none flex space-x-1 border-2 border-zinc-900">
                <button 
                    onClick={() => setUploadType('design')}
                    className={`px-6 py-2 rounded-none text-sm font-medium transition ${uploadType === 'design' ? 'bg-lime-400 text-zinc-900' : 'text-zinc-900 hover:bg-stone-100'}`}
                >
                    Upload Design
                </button>
                <button 
                    onClick={() => setUploadType('product')}
                    className={`px-6 py-2 rounded-none text-sm font-medium transition ${uploadType === 'product' ? 'bg-lime-400 text-zinc-900' : 'text-zinc-900 hover:bg-stone-100'}`}
                >
                    Upload Product
                </button>
            </div>
        </div>
        <div className="flex justify-center">
            <label htmlFor="file-upload" className="w-full max-w-lg cursor-pointer">
                <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-zinc-900 rounded-none hover:bg-stone-100 transition-colors">
                    {sourcePreview ? (
                        <img src={sourcePreview} alt="Source Preview" className="max-h-full max-w-full p-4 object-contain" />
                    ) : (
                        <>
                            <UploadCloud className="w-12 h-12 text-stone-500 mb-2"/>
                            <span className="text-stone-600">
                                {uploadType === 'design' ? 'Upload your design file' : 'Upload a photo of your product'}
                            </span>
                            <span className="text-sm text-stone-500">PNG, JPG, SVG</span>
                        </>
                    )}
                </div>
            </label>
            <input id="file-upload" type="file" className="hidden" accept="image/*" onChange={handleSourceFileChange} />
        </div>
    </div>
);


// --- Step 2 Component ---
interface Step2Props {
    mockupType: MockupType;
    setMockupType: (type: MockupType) => void;
}
const Step2: React.FC<Step2Props> = ({ mockupType, setMockupType }) => (
    <div>
        <h3 className="text-2xl font-semibold mb-6 text-center">Step 2: Choose Mockup Type</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <Card isSelected={mockupType === 'person'} onClick={() => setMockupType('person')}>
                <h4 className="text-lg font-bold mb-2">Person</h4>
                <p className="text-stone-600">A person wearing or interacting with the product.</p>
            </Card>
            <Card isSelected={mockupType === 'flatlay'} onClick={() => setMockupType('flatlay')}>
                <h4 className="text-lg font-bold mb-2">Flat Lay</h4>
                <p className="text-stone-600">Product-only mockup, arranged on a surface.</p>
            </Card>
        </div>
    </div>
);

// --- Step 3 Component ---
interface Step3Props {
    mockupType: MockupType;
    prompt: { scene: string; details: string; mood: string; };
    setPrompt: React.Dispatch<React.SetStateAction<{ scene: string; details: string; mood: string; }>>;
    applyTemplate: (template: PromptTemplate) => void;
    styleReferencePreview: string;
    handleStyleRefChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    clearStyleReference: () => void;
    modelImagePreview: string;
    handleModelImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    clearModelImage: () => void;
}
const Step3: React.FC<Step3Props> = ({ 
    mockupType, prompt, setPrompt, applyTemplate, 
    styleReferencePreview, handleStyleRefChange, clearStyleReference,
    modelImagePreview, handleModelImageChange, clearModelImage 
}) => {
    const templates = mockupType === 'person' ? PROMPT_TEMPLATES_PERSON : PROMPT_TEMPLATES_FLATLAY;
    return (
        <div>
            <h3 className="text-2xl font-semibold mb-2 text-center">Step 3: Describe the Scene</h3>
            <p className="text-stone-600 text-center mb-6">Use a template or write your own description.</p>
            <div className="flex gap-4 mb-6 justify-center flex-wrap">
                {templates.map(t => (
                    <Button key={t.name} variant="secondary" size="sm" onClick={() => applyTemplate(t)}>{t.name}</Button>
                ))}
            </div>
            <div className="space-y-4 max-w-xl mx-auto">
                <label className="block">
                    <span className="text-stone-600">Scene</span>
                    <input type="text" value={prompt.scene} onChange={e => setPrompt({...prompt, scene: e.target.value})} className="w-full mt-1 p-2 bg-white border-2 border-zinc-900 rounded-none focus:outline-none focus:border-lime-400" placeholder="e.g., a bustling city street" />
                </label>
                <label className="block">
                    <span className="text-stone-600">{mockupType === 'person' ? 'Person Details' : 'Product Details'}</span>
                    <input type="text" value={prompt.details} onChange={e => setPrompt({...prompt, details: e.target.value})} className="w-full mt-1 p-2 bg-white border-2 border-zinc-900 rounded-none focus:outline-none focus:border-lime-400" placeholder="e.g., a stylish person smiling" />
                </label>
                <label className="block">
                    <span className="text-stone-600">Mood of Photograph</span>
                    <input type="text" value={prompt.mood} onChange={e => setPrompt({...prompt, mood: e.target.value})} className="w-full mt-1 p-2 bg-white border-2 border-zinc-900 rounded-none focus:outline-none focus:border-lime-400" placeholder="e.g., warm, candid, lifestyle photo" />
                </label>
            </div>

            {mockupType === 'person' && (
                <div className="mt-8 max-w-xl mx-auto">
                    <h4 className="text-lg font-semibold text-center mb-4 text-zinc-900">Model Photo (Optional)</h4>
                    <p className="text-stone-500 text-center text-sm mb-4">Upload a photo of a person to use as the model in the mockup.</p>
                    <div className="flex justify-center">
                        {modelImagePreview ? (
                            <div className="relative">
                                <img src={modelImagePreview} alt="Model Preview" className="h-32 w-32 rounded-none object-cover border-2 border-zinc-900" />
                                <button onClick={clearModelImage} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-none p-1 hover:bg-red-600 transition z-10 border-2 border-zinc-900">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <label htmlFor="model-image-upload" className="w-full cursor-pointer">
                                <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-zinc-900 rounded-none hover:bg-stone-100 transition-colors">
                                    <UploadCloud className="w-8 h-8 text-stone-500 mb-2"/>
                                    <span className="text-stone-600">Upload model photo</span>
                                </div>
                            </label>
                        )}
                        <input id="model-image-upload" type="file" className="hidden" accept="image/*" onChange={handleModelImageChange} />
                    </div>
                </div>
            )}

            <div className="mt-8 max-w-xl mx-auto">
                <h4 className="text-lg font-semibold text-center mb-4 text-zinc-900">Style Reference (Optional)</h4>
                <p className="text-stone-500 text-center text-sm mb-4">Upload an image to guide the AI with a specific visual style, lighting, or composition.</p>
                <div className="flex justify-center">
                    {styleReferencePreview ? (
                        <div className="relative">
                            <img src={styleReferencePreview} alt="Style Reference Preview" className="h-32 w-32 rounded-none object-cover border-2 border-zinc-900" />
                            <button onClick={clearStyleReference} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-none p-1 hover:bg-red-600 transition z-10 border-2 border-zinc-900">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <label htmlFor="style-ref-upload" className="w-full cursor-pointer">
                            <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-zinc-900 rounded-none hover:bg-stone-100 transition-colors">
                                <UploadCloud className="w-8 h-8 text-stone-500 mb-2"/>
                                <span className="text-stone-600">Upload style image</span>
                            </div>
                        </label>
                    )}
                    <input id="style-ref-upload" type="file" className="hidden" accept="image/*" onChange={handleStyleRefChange} />
                </div>
            </div>
        </div>
    )
};

// --- Step 4 Component ---
interface Step4Props {
    uploadType: UploadType;
    projectName: string;
    setProjectName: (name: string) => void;
    productType: string;
    setProductType: (type: string) => void;
    customProductType: string;
    setCustomProductType: (name: string) => void;
    productColor: string;
    setProductColor: (color: string) => void;
    aspectRatio: AspectRatio;
    setAspectRatio: (ar: AspectRatio) => void;
}
const Step4: React.FC<Step4Props> = ({
    uploadType,
    projectName, setProjectName,
    productType, setProductType,
    customProductType, setCustomProductType,
    productColor, setProductColor,
    aspectRatio, setAspectRatio
}) => (
    <div>
        <h3 className="text-2xl font-semibold mb-6 text-center">Step 4: Final Details</h3>
        <div className="space-y-6 max-w-xl mx-auto">
             <label className="block">
                <span className="text-stone-600">Project Name</span>
                <input 
                    type="text" 
                    value={projectName} 
                    onChange={e => setProjectName(e.target.value)} 
                    className="w-full mt-1 p-2 bg-white border-2 border-zinc-900 rounded-none focus:outline-none focus:border-lime-400" 
                    placeholder="e.g., Summer Collection T-Shirt" 
                    required
                />
            </label>
            {uploadType === 'design' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block">
                            <span className="text-stone-600">Product Type</span>
                            <select value={productType} onChange={e => setProductType(e.target.value)} className="w-full mt-1 p-2 bg-white border-2 border-zinc-900 rounded-none focus:outline-none focus:border-lime-400 appearance-none">
                               {PRODUCT_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                               <option value="Other...">Other...</option>
                            </select>
                        </label>
                        {productType === 'Other...' && (
                            <div className="mt-4">
                                <label className="block">
                                    <span className="text-stone-600">Please specify</span>
                                    <input 
                                        type="text" 
                                        value={customProductType} 
                                        onChange={e => setCustomProductType(e.target.value)} 
                                        className="w-full mt-1 p-2 bg-white border-2 border-zinc-900 rounded-none focus:outline-none focus:border-lime-400" 
                                        placeholder="e.g., Water Bottle"
                                        required 
                                    />
                                </label>
                            </div>
                        )}
                    </div>
                     <label className="block">
                        <span className="text-stone-600">Product Base Color</span>
                        <div className="flex items-center mt-1 p-2 bg-white border-2 border-zinc-900 rounded-none">
                            <input type="color" value={productColor} onChange={e => setProductColor(e.target.value)} className="w-8 h-8 p-0 border-none bg-transparent cursor-pointer" />
                            <span className="ml-2 uppercase">{productColor}</span>
                        </div>
                    </label>
                </div>
            )}

            <div>
                <span className="text-stone-600 block mb-2">Aspect Ratio</span>
                <div className="flex flex-wrap gap-2">
                    {ASPECT_RATIOS.map(ar => (
                        <button key={ar} onClick={() => setAspectRatio(ar)} className={`px-4 py-2 rounded-none text-sm font-medium transition border-2 border-zinc-900 ${aspectRatio === ar ? 'bg-lime-400 text-zinc-900' : 'bg-white hover:bg-stone-100'}`}>
                            {ar}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    </div>
);

const MockupGenerator: React.FC<MockupGeneratorProps> = ({ onProjectCreated, onCancel }) => {
    const [step, setStep] = useState(1);
    const [uploadType, setUploadType] = useState<UploadType>('design');
    const [sourceFile, setSourceFile] = useState<File | null>(null);
    const [sourcePreview, setSourcePreview] = useState<string>('');
    const [mockupType, setMockupType] = useState<MockupType>('person');
    const [prompt, setPrompt] = useState({ scene: '', details: '', mood: '' });
    const [productColor, setProductColor] = useState('#ffffff');
    const [productType, setProductType] = useState(PRODUCT_TYPES[0]);
    const [customProductType, setCustomProductType] = useState('');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
    const [projectName, setProjectName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [styleReferenceFile, setStyleReferenceFile] = useState<File | null>(null);
    const [styleReferencePreview, setStyleReferencePreview] = useState<string>('');
    const [modelImageFile, setModelImageFile] = useState<File | null>(null);
    const [modelImagePreview, setModelImagePreview] = useState<string>('');

    const handleSourceFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSourceFile(file);
            setSourcePreview(URL.createObjectURL(file));
        }
    };
    
    const handleStyleRefChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setStyleReferenceFile(file);
            setStyleReferencePreview(URL.createObjectURL(file));
        }
    };

    const clearStyleReference = () => {
        setStyleReferenceFile(null);
        setStyleReferencePreview('');
        const input = document.getElementById('style-ref-upload') as HTMLInputElement;
        if (input) {
            input.value = '';
        }
    };

    const handleModelImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setModelImageFile(file);
            setModelImagePreview(URL.createObjectURL(file));
        }
    };

    const clearModelImage = () => {
        setModelImageFile(null);
        setModelImagePreview('');
        const input = document.getElementById('model-image-upload') as HTMLInputElement;
        if (input) {
            input.value = '';
        }
    };

    const handleNext = () => setStep(prev => prev + 1);
    const handleBack = () => setStep(prev => prev - 1);

    const applyTemplate = (template: PromptTemplate) => {
        setPrompt({ scene: template.scene, details: template.details, mood: template.mood });
    }

    const handleGenerate = async () => {
        if (!sourceFile || !projectName) return;
        setIsLoading(true);
        setError('');

        const aspectRatioCanvas = createBlankCanvas(aspectRatio);

        // Define image indices. The order of images passed to the API is critical.
        let imageCounter = 1;
        const sourceImageIndex = imageCounter++;
        const modelImageIndex = modelImageFile ? imageCounter++ : 0;
        const styleImageIndex = styleReferenceFile ? imageCounter++ : 0;
        const canvasImageIndex = imageCounter++;
        
        const finalProductType = productType === 'Other...' ? customProductType : productType;

        // --- Unified Prompt Generation ---
        const persona = `<persona>You are a world-class photorealistic mockup generation AI. Your purpose is to create commercially-viable product mockups by placing a subject into a new, generated scene, adhering to strict technical and creative constraints.</persona>`;

        let criticalRules: string;
        let assetsAndGoal: string;
        
        const modelReplicationRule = modelImageFile 
            ? `- **PERSON REPLICATION (NON-NEGOTIABLE):** Create a photorealistic image of the **exact same person** shown in Image ${modelImageIndex}. You MUST replicate their face, hair, and likeness with 100% accuracy. DO NOT use a different or similar-looking person. This is the most important rule.\n` 
            : '';

        if (uploadType === 'design') {
            criticalRules = `<critical_rules>
${modelReplicationRule}- **DESIGN FIDELITY (NON-NEGOTIABLE):** The graphic provided as Image ${sourceImageIndex} is a final, static design. You MUST place it onto the product exactly as it is provided. DO NOT alter, redraw, reinterpret, or modify the design in any way. It must be a direct, 1:1 copy of the source, preserving all colors and details perfectly.
- **FRAME & ASPECT RATIO (ABSOLUTE PRIORITY):** The final image MUST be a full-bleed photograph that perfectly matches the aspect ratio of the gray canvas (Image ${canvasImageIndex}). Use Image ${canvasImageIndex} ONLY as a shape and dimension reference. The scene described in <scene_brief> must extend to all four edges of the frame. Under NO circumstances should the gray canvas or its color be visible in the final output. The background MUST be the described scene.
- **FULL FRAME SCENE:** The generated scene MUST fill the entire frame. No letterboxing, empty bars, or borders.
- **SEAMLESS INTEGRATION:** The subject must be lit realistically according to the scene's lighting. It should look naturally part of the scene, with correct shadows and reflections.
${styleImageIndex > 0 ? `- **STYLE REFERENCE USAGE:** Use Image ${styleImageIndex} for artistic style ONLY (lighting, mood, composition). DO NOT copy its content (people, objects, etc.).\n` : ''}
</critical_rules>`;
            
            assetsAndGoal = `<goal>Your main goal is to take the design from Image ${sourceImageIndex} and place it perfectly onto a ${finalProductType} within a new, photorealistic scene. The design itself MUST NOT be changed.</goal>
<input_assets>
- Image ${sourceImageIndex} (The Design): A graphic to be placed on the product.
${modelImageIndex > 0 ? `- Image ${modelImageIndex} (Model Reference): The person to feature in the mockup.\n` : ''}
${styleImageIndex > 0 ? `- Image ${styleImageIndex} (Style Reference): An image for artistic style guidance.\n` : ''}
- Image ${canvasImageIndex} (Aspect Ratio Canvas): A technical guide for the final image's dimensions.
</input_assets>`;
        } else { // uploadType === 'product'
            criticalRules = `<critical_rules>
${modelReplicationRule}- **BACKGROUND REMOVAL (ABSOLUTE PRIORITY):** You MUST completely remove the original background from the product photo (Image ${sourceImageIndex}). No traces of the original background should remain.
- **FRAME & ASPECT RATIO (ABSOLUTE PRIORITY):** The final image MUST be a full-bleed photograph that perfectly matches the aspect ratio of the gray canvas (Image ${canvasImageIndex}). Use Image ${canvasImageIndex} ONLY as a shape and dimension reference. The scene described in <scene_brief> must extend to all four edges of the frame. Under NO circumstances should the gray canvas or its color be visible in the final output. The background MUST be the described scene.
- **FULL FRAME SCENE:** The generated scene MUST fill the entire frame. No letterboxing, empty bars, or borders.
- **SEAMLESS INTEGRATION:** The subject must be lit realistically according to the scene's lighting. It should look naturally part of the scene, with correct shadows and reflections.
${styleImageIndex > 0 ? `- **STYLE REFERENCE USAGE:** Use Image ${styleImageIndex} for artistic style ONLY (lighting, mood, composition). DO NOT copy its content (people, objects, etc.).\n` : ''}
</critical_rules>`;

            assetsAndGoal = `<goal>Your main goal is to isolate the product from Image ${sourceImageIndex}, discard its original background completely, and integrate it seamlessly into a new, photorealistic scene.</goal>
<input_assets>
- Image ${sourceImageIndex} (The Product): A photo of the product to be placed in the scene.
${modelImageIndex > 0 ? `- Image ${modelImageIndex} (Model Reference): The person to feature in the mockup.\n` : ''}
${styleImageIndex > 0 ? `- Image ${styleImageIndex} (Style Reference): An image for artistic style guidance.\n` : ''}
- Image ${canvasImageIndex} (Aspect Ratio Canvas): A technical guide for the final image's dimensions.
</input_assets>`;
        }

        let sceneBrief: string;
        const subjectText = modelImageFile 
            ? `A photorealistic, identical recreation of the person from Image ${modelImageIndex}. ${prompt.details}.`
            : (mockupType === 'person' ? `A person (${prompt.details})` : `A ${mockupType} of the product`);

        if (uploadType === 'design') {
            const actionAttire = mockupType === 'person' 
                ? `The person is wearing a ${finalProductType} (base color near hex ${productColor}). Place the design from Image ${sourceImageIndex} onto the ${finalProductType}, ensuring it is an **exact, unmodified replica** of the source design.`
                : `A ${mockupType} of a ${finalProductType} (base color near hex ${productColor}). The design from Image ${sourceImageIndex} is featured on it. It is CRITICAL that the design is an **exact, unmodified replica** of the source. (${prompt.details}).`;
            
            sceneBrief = `<scene_brief>
- Subject: ${subjectText}
- Action/Attire: ${actionAttire}
- Environment: ${prompt.scene}
- Photography Style: ${prompt.mood}
</scene_brief>`;
        } else { // uploadType === 'product'
            const action = `The subject is using or interacting with the product from Image ${sourceImageIndex}.`;
            sceneBrief = `<scene_brief>
- Subject: ${subjectText}
- Action: ${action}
- Environment: ${prompt.scene}
- Photography Style: ${prompt.mood}
</scene_brief>`;
        }

        const fullPrompt = `${persona}\n${criticalRules}\n${assetsAndGoal}\n${sceneBrief}`;
        
        try {
            const result = await generateMockup(sourceFile, fullPrompt, { 
                styleReferenceFile, 
                modelImageFile,
                aspectRatioCanvas
            });
            const { data: base64Original, mimeType: originalMimeType } = await fileToBase64(sourceFile);

            const newProject: Omit<Project, 'thumbnailImage' | 'variations'> = {
                id: new Date().toISOString(),
                name: projectName,
                generatedImage: result.image,
                generatedImageMimeType: 'image/png', // Gemini API returns PNG
                sourceImage: base64Original,
                sourceImageMimeType: originalMimeType,
                prompt: fullPrompt,
                createdAt: new Date().toISOString()
            };
            onProjectCreated(newProject);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const renderStep = () => {
        switch (step) {
            case 1: 
                return <Step1 uploadType={uploadType} setUploadType={setUploadType} sourcePreview={sourcePreview} handleSourceFileChange={handleSourceFileChange} />;
            case 2: 
                return <Step2 mockupType={mockupType} setMockupType={setMockupType} />;
            case 3: 
                return <Step3 
                    mockupType={mockupType} 
                    prompt={prompt} 
                    setPrompt={setPrompt} 
                    applyTemplate={applyTemplate} 
                    styleReferencePreview={styleReferencePreview}
                    handleStyleRefChange={handleStyleRefChange}
                    clearStyleReference={clearStyleReference}
                    modelImagePreview={modelImagePreview}
                    handleModelImageChange={handleModelImageChange}
                    clearModelImage={clearModelImage}
                />;
            case 4: 
                return <Step4 
                    uploadType={uploadType}
                    projectName={projectName} setProjectName={setProjectName}
                    productType={productType} setProductType={setProductType}
                    customProductType={customProductType} setCustomProductType={setCustomProductType}
                    productColor={productColor} setProductColor={setProductColor}
                    aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
                />;
            default: 
                return null;
        }
    }

    return (
        <div className="max-w-4xl mx-auto bg-white p-8 rounded-none shadow-2xl animate-fade-in-up border-2 border-zinc-900 neo-shadow">
           {isLoading ? (
               <div className="text-center py-20">
                   <div className="flex justify-center items-center">
                       <svg className="animate-spin mr-3 h-8 w-8 text-zinc-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                         <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                         <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                       </svg>
                       <span className="text-xl">Generating Mockup...</span>
                   </div>
                   <p className="text-stone-600 mt-4">Processing your canvas. Hang tight.</p>
               </div>
           ) : (
            <>
                <div className="mb-8">
                    {renderStep()}
                </div>
                {error && <p className="text-red-500 text-center mb-4">{error}</p>}
                <div className="flex justify-between mt-10">
                    <Button variant="secondary" onClick={step === 1 ? onCancel : handleBack}>{step === 1 ? 'Cancel' : 'Back'}</Button>
                    {step < 4 ? (
                        <Button onClick={handleNext} disabled={step === 1 && !sourceFile}>Next</Button>
                    ) : (
                        <Button 
                            onClick={handleGenerate} 
                            isLoading={isLoading} 
                            disabled={!projectName || (productType === 'Other...' && !customProductType)}
                        >
                            Generate Mockup
                        </Button>
                    )}
                </div>
            </>
           )}
        </div>
    );
};

export default MockupGenerator;