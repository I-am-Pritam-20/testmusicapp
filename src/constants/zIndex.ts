export const Z_INDEX = {
  /** Create Playlist modal, app alerts (removal/deletion/permission
   *  requests), toasts (back-to-exit, added-to-playlist, offline/online). */
  overlaysTop: 150,
  /** QueueSheet, SleepTimerSheet, MenuSheet — stacked LIFO among themselves. */
  stackedSheets: 100,
  /** The full-player native sheet. */
  fullPlayer: 50,
  /** Bottom tab bar, mini player, screen/app headers. */
  chrome: 25,
  /** Top/bottom fade gradients over scrollable screen content. */
  edgeGradients: 20,
  /** Ordinary screen content. */
  screenContent: 15,
  /** App background layer. */
  appBackground: 10,
  /** Root background, below everything. */
  rootBackground: 0,
} as const;