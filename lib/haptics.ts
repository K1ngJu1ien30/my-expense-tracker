// Type-safe map of friendly names to `@capacitor/haptics` ImpactStyle enum
// values. We derive the value-type from a dynamic import so we stay decoupled
// from whether the package is installed at type-check time on web builds.
type ImpactStyleEnum = typeof import("@capacitor/haptics")["ImpactStyle"];
type ImpactStyleValue = ImpactStyleEnum[keyof ImpactStyleEnum];

const haptic = async (style: string) => {
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const map: Record<string, ImpactStyleValue> = {
      light: ImpactStyle.Light,
      medium: ImpactStyle.Medium,
      heavy: ImpactStyle.Heavy,
    };
    await Haptics.impact({ style: map[style] || ImpactStyle.Light });
  } catch {
    // Silent on web — no haptics available
  }
};

export const NativeHaptics = {
  lightTick: async () => {
    try {
      const { Haptics } = await import("@capacitor/haptics");
      await Haptics.vibrate({ duration: 10 });
    } catch {}
  },

  successMedium: () => haptic("medium"),

  heavyDoubleThud: async () => {
    await haptic("heavy");
    await new Promise(r => setTimeout(r, 150));
    await haptic("heavy");
  },

  errorShake: async () => {
    try {
      const { Haptics } = await import("@capacitor/haptics");
      await Haptics.vibrate({ duration: 300 });
    } catch {}
  },

  creepyHeartbeat: async () => {
    try {
      const { Haptics } = await import("@capacitor/haptics");
      let count = 0;
      const interval = setInterval(async () => {
        if (count >= 5) {
          clearInterval(interval);
          return;
        }
        count++;
        try {
          await Haptics.vibrate({ duration: 50 });
          await new Promise(r => setTimeout(r, 100));
          await Haptics.vibrate({ duration: 80 });
        } catch {
          clearInterval(interval);
        }
      }, 600);
    } catch {}
  },
};
