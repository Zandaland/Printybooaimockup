
import React from 'react';
import Button from './ui/Button';
import { ArrowRight } from 'lucide-react';

interface LandingPageProps {
  onEnterStudio: () => void;
}

const PlaceholderCard: React.FC<{ title: string; bgColor: string; }> = ({ title, bgColor }) => (
    <div className={`aspect-square w-full border-2 border-zinc-900 flex items-center justify-center p-4 ${bgColor} neo-shadow`}>
        <h3 className="text-xl md:text-2xl text-zinc-900 text-center">{title}</h3>
    </div>
);


const LandingPage: React.FC<LandingPageProps> = ({ onEnterStudio }) => {
  return (
    <div className="min-h-screen bg-white text-zinc-900 flex items-center justify-center p-4 md:p-8">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              
              <div className="text-center lg:text-left">
                  <h1 className="text-5xl md:text-7xl font-medium tracking-tighter text-zinc-900">
                      RAW IDEAS.
                      <br />
                      REAL MOCKUPS.
                  </h1>
                  <p className="mt-6 text-lg md:text-xl text-stone-600 max-w-md mx-auto lg:mx-0">
                      Printyboo is the honest canvas for POD creators. A powerful, no-fluff tool to generate professional product mockups in seconds. No templates. No limits.
                  </p>
                  <Button onClick={onEnterStudio} size="md" className="mt-10 mx-auto lg:mx-0">
                      <span>Enter Studio</span>
                      <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
              </div>
              
              <div className="w-full max-w-md mx-auto lg:max-w-none">
                  <div className="grid grid-cols-2 gap-4 lg:rotate-3 transition-transform duration-300 hover:rotate-0">
                      <div className="pt-8">
                        <PlaceholderCard title="Urban T-Shirt Mockup" bgColor="bg-stone-200" />
                      </div>
                      <div>
                        <PlaceholderCard title="Minimalist Mug" bgColor="bg-lime-200" />
                      </div>
                      <div className="pt-8">
                        <PlaceholderCard title="Flatlay Tote Bag" bgColor="bg-lime-200" />
                      </div>
                      <div>
                        <PlaceholderCard title="Studio Hoodie" bgColor="bg-stone-200" />
                      </div>
                  </div>
              </div>

          </div>
        </div>
    </div>
  );
};

export default LandingPage;
