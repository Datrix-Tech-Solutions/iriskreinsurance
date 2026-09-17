import { create } from 'zustand';
import { toast as sonnerToast } from 'sonner';

export interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error';
}

interface ToastStore {
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
}

export const useToastStore = create<ToastStore>(() => ({
  addToast: ({ message, type }) => sonnerToast[type](message),
}));
