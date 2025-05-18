import { UserProfile } from '../models/user';
import supabase from './supabase';

const DEFAULT_USER_PROFILE: UserProfile = {
  id: '',
  email: '',
  full_name: '',
  avatar_url: '',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};


export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      // If profile doesn't exist yet, return null instead of throwing
      if (error.code === 'PGRST116') {
        console.log('Profile not found for user:', userId, 'This is normal for new users');
        return null;
      }
      
      // Handle case where profiles table does not exist
      if (error.code === '42P01' || error.message.includes('relation "public.profiles" does not exist')) {
        console.warn('Profiles table does not exist in the database. Creating default profile.');
        // Return a default profile object that won't break the app
        return DEFAULT_USER_PROFILE;
      }
      
      console.error('Error fetching user profile:', error);
      return null; // Return null instead of throwing to prevent app crashes
    }
    return data;
  } catch (error) {
    console.error('Unexpected error in getUserProfile:', error);
    return null; // Return null for any other errors to keep the app working
  }
};

export const createOrUpdateUserProfile = async (profileData: UserProfile): Promise<UserProfile | null> => {
  if (!supabase) return null;
  // Check if profile exists
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', profileData.id)
    .single();
  
  let result;
  
  if (existingProfile) {
    // Update existing profile
    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...profileData,
        updated_at: new Date().toISOString()
      })
      .eq('id', profileData.id)
      .select();
    
    if (error) throw error;
    result = data[0];
  } else {
    // Create new profile
    const { data, error } = await supabase
      .from('profiles')
      .insert(profileData)
      .select();
    
    if (error) throw error;
    result = data[0];
  }
  
  return result;
};

export const updateUserProfile = async (userId: string, updates: UserProfile): Promise<UserProfile | null> => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)
    .select();
  
  if (error) throw error;
  return data[0];
};