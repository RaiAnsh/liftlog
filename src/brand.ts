export const APP_NAME = 'ARLog'

/**
 * !! NEVER CHANGE THIS VALUE !!
 * It is the name of the IndexedDB database that holds every workout, set, template and setting.
 * Changing it makes the app open a brand-new, empty database and your history would appear to vanish
 * (it would still exist, orphaned, under the old name). The app was renamed from "LiftLog" to "ARLog"
 * on purpose without touching this. A test (src/db/safety.test.ts) fails if it changes.
 */
export const DB_NAME = 'liftlog'
