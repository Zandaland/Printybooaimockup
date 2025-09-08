
import type { AspectRatio, PromptTemplate } from './types';

export const PRODUCT_TYPES = [
    'T-shirt',
    'Mug',
    'Hoodie',
    'Sweatshirt',
    'Tote Bag',
    'Cap',
    'Beanie',
    'Poster',
    'Canvas Print',
    'Phone Case',
    'Pillow',
    'Sticker',
    'Baby Onesie'
];

export const ASPECT_RATIOS: AspectRatio[] = ['1:1', '4:3', '3:4', '16:9', '9:16'];

export const PROMPT_TEMPLATES_PERSON: PromptTemplate[] = [
    {
        name: "Urban Casual",
        scene: "a bustling city street with blurred background",
        details: "A young, stylish person with a confident expression, walking towards the camera",
        mood: "candid, energetic, street style photography"
    },
    {
        name: "Cafe Vibe",
        scene: "a cozy, sunlit cafe with wooden furniture",
        details: "A person sitting at a table, holding the product and smiling naturally",
        mood: "warm, relaxed, lifestyle photoshoot"
    },
    {
        name: "Minimalist Studio",
        scene: "a clean, minimalist studio with neutral colored walls",
        details: "A model posing against the plain background, showcasing the product clearly",
        mood: "professional, high-fashion, sharp focus"
    }
];

export const PROMPT_TEMPLATES_FLATLAY: PromptTemplate[] = [
    {
        name: "Modern & Clean",
        scene: "a white marble surface",
        details: "The product is neatly placed in the center, surrounded by relevant accessories like a laptop and a notebook",
        mood: "bright, airy, top-down shot"
    },
    {
        name: "Rustic Charm",
        scene: "a dark wood texture background",
        details: "The product is arranged with natural elements like green leaves and a linen cloth",
        mood: "earthy, organic, moody lighting"
    },
    {
        name: "Vibrant & Playful",
        scene: "a solid, vibrant colored background",
        details: "The product is placed with a dynamic shadow, with geometric shapes scattered around",
        mood: "bold, graphic, high-contrast"
    }
];