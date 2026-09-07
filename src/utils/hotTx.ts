/**
 * Limity transakcji dla gorących ścieżek zapisu (oferty/zamówienia/PZ).
 * 1 pisarz SQLite: pod loadem kolejka przekracza domyślne 5 s tx
 * (P2028 → mylący 500). Ujednolicono po P1-F/FINAL (load-100: PUT/DELETE 500).
 * Tła/admin (telemetria, ML, cenniki) zostają na domyślnych.
 */
export const HOT_TX_OPTS = { maxWait: 15000, timeout: 30000 };
