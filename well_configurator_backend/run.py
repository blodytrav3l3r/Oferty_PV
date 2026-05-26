import uvicorn
import time
import sys
import os


def main():
    """
    Uruchamia serwer z auto-restartem w razie crasha.
    start.bat czuwa nad tym procesem i restartuje go jeśli wyjdzie z kodem != 0.
    """
    max_consecutive_crashes = 5
    crash_count = 0
    retry_delay = 2

    while crash_count < max_consecutive_crashes:
        try:
            print(f"[run.py] Starting server on 0.0.0.0:8000...")
            uvicorn.run(
                "api.main:app",
                host="0.0.0.0",
                port=8000,
                reload=True,
                log_level="info",
            )
            # uvicorn.run() zwraca normalnie tylko gdy reload=parent otrzyma sygnał zamknięcia
            print("[run.py] Server shut down normally.")
            # Jeśli to był reload (plik zmieniony), uvicorn sam restartuje →
            # nie dochodzimy tu. Jeśli doszliśmy → prawdopodobnie zamknięcie.
            # Sprawdźmy czy proces-rodzic w reload mode dostał sygnał:
            break
        except SystemExit as e:
            # reload=True: gdy dziecko crashuje, rodzic woła sys.exit(1)
            if e.code == 0:
                print("[run.py] Clean exit (SystemExit 0). Shutting down.")
                break
            crash_count += 1
            print(f"[run.py] Server crashed (SystemExit {e.code}) [{crash_count}/{max_consecutive_crashes}].")
        except KeyboardInterrupt:
            print("[run.py] KeyboardInterrupt. Shutting down.")
            sys.exit(0)
        except Exception as e:
            crash_count += 1
            print(f"[run.py] SERVER CRASHED [{crash_count}/{max_consecutive_crashes}]: {e}", file=sys.stderr)
            import traceback
            traceback.print_exc()

        if crash_count >= max_consecutive_crashes:
            print(f"[run.py] Too many consecutive crashes ({max_consecutive_crashes}). Giving up.", file=sys.stderr)
            sys.exit(1)

        # Backoff
        print(f"[run.py] Restarting in {retry_delay}s...")
        time.sleep(retry_delay)
        retry_delay = min(retry_delay * 2, 30)

    print("[run.py] Exiting.")


if __name__ == "__main__":
    main()
