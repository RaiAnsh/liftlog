export const APP_NAME = 'LiftLog'

/**
 * !! NEVER CHANGE THIS VALUE !!
 * It is the name of the IndexedDB database that holds every workout, set, template and setting.
 * Changing it makes the app open a brand-new, empty database and your history would appear to vanish
 * (it would still exist, orphaned, under the old name). The app has been renamed in the UI before without
 * touching this, so it is safe to rename again; just never change this constant. A test
 * (src/db/safety.test.ts) fails if it changes.
 */
export const DB_NAME = 'liftlog'
