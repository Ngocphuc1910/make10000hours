import { create } from 'zustand';

interface FormEditState {
  activeFormIds: Set<string>;
  setFormActive: (formId: string) => void;
  setFormInactive: (formId: string) => void;
  isAnyFormActive: () => boolean;
  isFormActive: (formId: string) => boolean;
}

export const useFormEditStore = create<FormEditState>((set, get) => ({
  activeFormIds: new Set(),
  
  setFormActive: (formId: string) => {
    set(state => {
      if (state.activeFormIds.has(formId)) {
        return state; // No change needed, return same state
      }
      return {
        activeFormIds: new Set([...state.activeFormIds, formId])
      };
    });
  },
  
  setFormInactive: (formId: string) => {
    set(state => {
      if (!state.activeFormIds.has(formId)) {
        return state; // No change needed, return same state
      }
      const newSet = new Set(state.activeFormIds);
      newSet.delete(formId);
      return { activeFormIds: newSet };
    });
  },
  
  isAnyFormActive: () => {
    return get().activeFormIds.size > 0;
  },
  
  isFormActive: (formId: string) => {
    return get().activeFormIds.has(formId);
  }
}));