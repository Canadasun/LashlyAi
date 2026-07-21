import { useWindowDimensions } from 'react-native';

// iPhone is locked to portrait-only in Info.plist (UISupportedInterfaceOrientations
// has no landscape entry), so its logical width never exceeds ~430pt even on the
// largest Pro Max. iPad allows landscape (UISupportedInterfaceOrientations~ipad) and
// is never narrower than ~744pt even in split-screen portrait on the smallest model.
// A single width breakpoint sitting well clear of both ends is safe and doesn't need
// a platform check.
const TABLET_BREAKPOINT = 600;

export interface DeviceClass {
  isTablet: boolean;
  isLandscape: boolean;
  width: number;
  height: number;
}

export function useDeviceClass(): DeviceClass {
  const { width, height } = useWindowDimensions();
  return {
    isTablet: width >= TABLET_BREAKPOINT,
    isLandscape: width > height,
    width,
    height,
  };
}
