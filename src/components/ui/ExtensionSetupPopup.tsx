import React from 'react';

interface ExtensionSetupPopupProps {
  isVisible: boolean;
  onClose: () => void;
  onSetupClick: () => void;
  onReload?: () => void;
}

export const ExtensionSetupPopup: React.FC<ExtensionSetupPopupProps> = ({ 
  isVisible, 
  onClose, 
  onSetupClick,
  onReload
}) => {
  if (!isVisible) return null;

  return (
    <div className="absolute left-0 top-full mt-2 w-[280px] bg-white rounded-xl shadow-lg border border-gray-100 p-3 z-50 transform origin-top-left transition-all duration-300">
      <div className="relative">
        <button 
          onClick={onClose}
          className="absolute right-0 top-0 p-1 text-gray-400 hover:text-gray-600"
        >
          <div className="w-4 h-4 flex items-center justify-center">
            <i className="ri-close-line"></i>
          </div>
        </button>
        <div className="flex items-start gap-2.5 pr-4">
          <div className="w-8 h-8 rounded-lg bg-[rgba(187,95,90,0.1)] flex items-center justify-center flex-shrink-0">
            <i className="ri-puzzle-line text-lg text-[rgba(187,95,90,1)]"></i>
          </div>
          <div className="flex-1">
            <h3 className="text-xs font-semibold text-gray-900 mb-0.5">Set up extension</h3>
            <p className="text-xs text-gray-500 mb-2.5 leading-relaxed">
              We need extension to help you block distracting sites & track site usage
            </p>
            <p className="text-xs text-gray-500 mb-2.5 leading-relaxed">
              In case you already installed the extension, please reload and try again
            </p>
            <div className="flex gap-2">
              <button 
                onClick={onReload || (() => window.location.reload())}
                className="flex-1 px-3 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Reload
              </button>
              <button 
                onClick={onSetupClick}
                className="flex-1 px-3 py-1.5 bg-gradient-to-r from-[rgba(187,95,90,0.9)] via-[rgba(236,72,153,0.9)] to-[rgba(251,146,60,0.9)] text-white text-xs font-medium rounded-lg hover:bg-opacity-90 transition-colors rounded-button whitespace-nowrap flex items-center justify-center"
              >
                Set up
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};