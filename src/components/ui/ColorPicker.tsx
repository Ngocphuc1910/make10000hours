import React, { useState, useRef, useEffect } from 'react';
import { Icon } from './Icon';
import { PRESET_COLORS, isValidHexColor } from '../../utils/colorUtils';

interface ColorPickerProps {
  isOpen: boolean;
  onClose: () => void;
  currentColor: string;
  onColorChange: (color: string) => void;
  onSave: () => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({
  isOpen,
  onClose,
  currentColor,
  onColorChange,
  onSave
}) => {
  const [inputColor, setInputColor] = useState(currentColor);
  const [isValidColor, setIsValidColor] = useState(true);
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Use shared preset colors
  const presetColors = PRESET_COLORS;

  // Update input when currentColor changes
  useEffect(() => {
    setInputColor(currentColor);
    setIsValidColor(true);
  }, [currentColor]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Use shared validation function
  const validateHexColor = isValidHexColor;

  const handleInputChange = (value: string) => {
    setInputColor(value);
    const isValid = validateHexColor(value);
    setIsValidColor(isValid);
    
    if (isValid) {
      onColorChange(value);
    }
  };

  const handlePresetColorClick = (color: string) => {
    setInputColor(color);
    setIsValidColor(true);
    onColorChange(color);
  };

  const handleSave = () => {
    if (isValidColor) {
      onSave();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValidColor) {
      handleSave();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]" data-color-picker-modal>
      <div 
        ref={modalRef}
        className="bg-background-secondary rounded-lg shadow-lg p-6 w-96 max-w-[90vw]"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-text-primary">Change Project Color</h3>
          <button 
            onClick={onClose}
            className="p-1 rounded-md hover:bg-background-container transition-colors duration-200"
          >
            <Icon name="close-line" size={20} className="text-text-secondary" />
          </button>
        </div>

        {/* Current Color Preview */}
        <div className="mb-6">
          <div className="text-sm text-text-secondary mb-2">Current Color</div>
          <div className="flex items-center space-x-3">
            <div 
              className="w-8 h-8 rounded-md border border-border"
              style={{ backgroundColor: inputColor }}
            />
            <span className="text-sm font-medium text-text-primary">{inputColor}</span>
          </div>
        </div>

        {/* Color Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-text-primary mb-2">
            Hex Color Code
          </label>
          <input
            ref={inputRef}
            type="text"
            value={inputColor}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="#BB5F5A"
            className={`w-full px-3 py-2 border rounded-md text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary bg-background-primary text-text-primary ${
              isValidColor 
                ? 'border-border focus:border-primary' 
                : 'border-red-300 focus:border-red-500 focus:ring-red-500'
            }`}
          />
          {!isValidColor && (
            <p className="mt-1 text-sm text-red-600">
              Please enter a valid hex color (e.g., #BB5F5A)
            </p>
          )}
        </div>

        {/* Preset Colors */}
        <div className="mb-6">
          <div className="text-sm font-medium text-text-primary mb-3">Preset Colors</div>
          <div className="grid grid-cols-6 gap-2">
            {presetColors.map((color) => (
              <button
                key={color}
                onClick={() => handlePresetColorClick(color)}
                className={`w-8 h-8 rounded-md border-2 transition-all duration-200 hover:scale-110 ${
                  inputColor === color 
                    ? 'border-text-secondary ring-2 ring-primary ring-offset-1' 
                    : 'border-border hover:border-text-secondary'
                }`}
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValidColor}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
              isValidColor
                ? 'bg-primary text-white hover:bg-primary/90'
                : 'bg-background-container text-text-secondary cursor-not-allowed'
            }`}
          >
            Save Color
          </button>
        </div>
      </div>
    </div>
  );
};

export default ColorPicker; 