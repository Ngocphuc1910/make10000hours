import React, { useState, useEffect } from 'react';
import { User, Save, X, Camera } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const ProfileSettings = ({ onClose }) => {
  const { userProfile, updateProfile, isAuthLoading, authError } = useAuth();
  
  const [formData, setFormData] = useState({
    full_name: '',
    avatar_url: ''
  });
  const [previewAvatar, setPreviewAvatar] = useState('');
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  // Initialize the form with user profile data
  useEffect(() => {
    if (userProfile) {
      setFormData({
        full_name: userProfile.full_name || '',
        avatar_url: userProfile.avatar_url || ''
      });
      setPreviewAvatar(userProfile.avatar_url || '');
    }
  }, [userProfile]);
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Basic validation
    if (!file.type.includes('image')) {
      setFormError('Please upload an image file');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB
      setFormError('Image must be smaller than 5MB');
      return;
    }
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewAvatar(reader.result);
    };
    reader.readAsDataURL(file);
    
    try {
      setIsUploading(true);
      
      // Generate a unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('user-content')
        .upload(filePath, file);
        
      if (error) throw error;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('user-content')
        .getPublicUrl(filePath);
      
      // Update form data with the new avatar URL
      setFormData({
        ...formData,
        avatar_url: publicUrl
      });
      
      setSuccessMessage('Avatar uploaded successfully');
      setFormError('');
    } catch (error) {
      console.error('Error uploading avatar:', error);
      setFormError('Failed to upload avatar');
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSuccessMessage('');
    
    if (!formData.full_name?.trim()) {
      setFormError('Name is required');
      return;
    }
    
    try {
      await updateProfile(formData);
      setSuccessMessage('Profile updated successfully');
      
      // Close the modal after a delay
      setTimeout(() => {
        if (onClose) onClose();
      }, 2000);
    } catch (error) {
      console.error('Error updating profile:', error);
      // Auth error is handled by the useAuth hook
    }
  };
  
  // Generate avatar placeholder if no avatar url
  const getInitials = (name) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-lg p-6 relative">
        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <X className="w-5 h-5" />
        </button>
        
        <h2 className="text-2xl font-bold mb-6 dark:text-white">Profile Settings</h2>
        
        <form onSubmit={handleSubmit}>
          {/* Avatar section */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative">
              {previewAvatar ? (
                <img 
                  src={previewAvatar} 
                  alt="User avatar" 
                  className="w-24 h-24 rounded-full object-cover border-2 border-gray-200 dark:border-gray-700"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xl font-semibold text-gray-700 dark:text-gray-300">
                  {getInitials(formData.full_name)}
                </div>
              )}
              
              <label className="absolute bottom-0 right-0 w-8 h-8 bg-gray-100 dark:bg-gray-600 rounded-full flex items-center justify-center cursor-pointer shadow-md hover:bg-gray-200 dark:hover:bg-gray-500">
                <Camera className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleAvatarChange}
                  disabled={isUploading}
                />
              </label>
            </div>
          </div>
          
          {/* Name field */}
          <div className="mb-4">
            <label className="block text-gray-700 dark:text-gray-300 mb-2">Full Name</label>
            <input
              type="text"
              placeholder="John Doe"
              name="full_name"
              value={formData.full_name}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              required
            />
          </div>
          
          {/* Error and success messages */}
          {formError && (
            <div className="mb-4 text-sm text-red-500 dark:text-red-400">
              {formError}
            </div>
          )}
          
          {authError && (
            <div className="mb-4 text-sm text-red-500 dark:text-red-400">
              {authError}
            </div>
          )}
          
          {successMessage && (
            <div className="mb-4 text-sm text-green-500 dark:text-green-400">
              {successMessage}
            </div>
          )}
          
          {/* Submit button */}
          <button
            type="submit"
            disabled={isAuthLoading || isUploading}
            className="w-full py-2 px-4 bg-gray-900 dark:bg-gray-800 text-white font-medium rounded-lg hover:bg-gray-800 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-70"
          >
            {isAuthLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProfileSettings; 