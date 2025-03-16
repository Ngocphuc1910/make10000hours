import React, { useState } from 'react';
import { Music, X } from 'lucide-react';
import { cn } from '../../utils/cn';

const SpotifyEmbed = () => {
  const [isVisible, setIsVisible] = useState(false);
  
  return (
    <>
      <button 
        className={cn(
          "fixed bottom-4 right-4 z-40 flex items-center justify-center",
          "w-10 h-10 rounded-full shadow-lg transition-all",
          "bg-black/60 hover:bg-black/80 text-white",
          isVisible && "bg-black/80"
        )}
        onClick={() => setIsVisible(!isVisible)}
        title={isVisible ? "Hide Music Player" : "Show Music Player"}
      >
        {isVisible ? <X className="w-5 h-5" /> : <Music className="w-5 h-5" />}
      </button>
      
      <div 
        className={cn(
          "fixed bottom-0 left-0 w-full z-30 transition-transform duration-300 ease-in-out",
          "bg-gradient-to-t from-black/80 to-black/40 backdrop-blur-sm py-4",
          isVisible ? "translate-y-0" : "translate-y-full"
        )}
      >
        <div className="container max-w-3xl mx-auto px-4">
          <iframe 
            src="https://open.spotify.com/embed/playlist/6dEdaN9tg6S5x4v698ARfb?utm_source=generator" 
            width="100%" 
            height="80" 
            frameBorder="0" 
            allowtransparency="true" 
            allow="encrypted-media"
            title="Spotify Player"
            className="rounded-lg shadow-lg"
          />
        </div>
      </div>
    </>
  );
};

export default SpotifyEmbed; 