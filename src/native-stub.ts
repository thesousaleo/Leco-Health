/* Substitutos usados só no build de arquivo único (scripts/build-single.mjs),
   onde os pacotes do Capacitor não estão instalados. */
const noop = async (..._a: unknown[]): Promise<any> => ({});
export const Capacitor = { isNativePlatform: () => false, getPlatform: () => 'web' };
export const Haptics = { impact: noop, notification: noop };
export const ImpactStyle = { Light: 'LIGHT' } as const;
export const NotificationType = { Success: 'SUCCESS' } as const;
export const LocalNotifications = {
  checkPermissions: async () => ({ display: 'denied' }), requestPermissions: async () => ({ display: 'denied' }),
  getPending: async () => ({ notifications: [] as { id: number }[] }), cancel: noop, schedule: noop,
};
export const Directory = { Cache: 'CACHE' } as const;
export const Filesystem = { writeFile: async () => ({ uri: '' }) };
export const Share = { share: noop };
export const NativeBiometric = { isAvailable: async () => ({ isAvailable: false }), verifyIdentity: noop };
export const StatusBar = { setStyle: noop, setBackgroundColor: noop };
export const Style = { Dark: 'DARK', Light: 'LIGHT' } as const;
export const App = { addListener: async () => ({ remove: () => {} }), minimizeApp: noop, exitApp: noop };
