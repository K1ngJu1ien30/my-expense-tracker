const haptic = async (style: string) => {
  try {
    // @ts-ignore - Native plugin, not available in web builds
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const map: Record<string, any> = {
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
      // @ts-ignore
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
      // @ts-ignore
      const { Haptics } = await import("@capacitor/haptics");
      await Haptics.vibrate({ duration: 300 });
    } catch {}
  },

  creepyHeartbeat: async () => {
    try {
      // @ts-ignore
      const { Haptics } = await import("@capacitor/haptics");
      let count = 0;
      const interval = setInterval(async () => {
        if (count >= 5) { clearInterval(interval); return; }
        await Haptics.vibrate({ duration: 50 });
        await new Promise(r => setTimeout(r, 100));
        await Haptics.vibrate({ duration: 80 });
        count++;
      }, 600);
    } catch {}
  },
};
