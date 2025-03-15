import React, { useState } from 'react';
import '../styles/SpotifyEmbed.css';

const SpotifyEmbed = () => {
  const [isVisible, setIsVisible] = useState(false);
  
  return (
    <>
      <button 
        className="spotify-toggle" 
        onClick={() => setIsVisible(!isVisible)}
        title={isVisible ? "Hide Music Player" : "Show Music Player"}
      >
        {isVisible ? '🎵 ✕' : '🎵'}
      </button>
      
      {isVisible && (
        <div className="spotify-container">
          <iframe 
            src="https://open.spotify.com/embed/playlist/6dEdaN9tg6S5x4v698ARfb?utm_source=generator" 
            width="300" 
            height="80" 
            frameBorder="0" 
            allowtransparency="true" 
            allow="encrypted-media"
            title="Spotify Player"
          />
        </div>
      )}
    </>
  );
};

export default SpotifyEmbed; 