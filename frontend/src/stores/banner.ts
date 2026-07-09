import { create } from 'zustand';

interface BannerStore {
  message: string | null;
  showBanner: (message: string) => void;
  dismissBanner: () => void;
}

export const useBannerStore = create<BannerStore>((set) => ({
  message: null,
  showBanner: (message) => set({ message }),
  dismissBanner: () => set({ message: null }),
}));
