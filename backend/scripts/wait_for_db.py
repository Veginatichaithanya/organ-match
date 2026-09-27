import time
import os
import sys
import socket

def wait_for_postgres(max_retries=30, retry_interval=2):
    db_url = os.getenv("DATABASE_URL", "")
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = int(os.getenv("POSTGRES_PORT", "5432"))

    if db_url and "@" in db_url:
        try:
            netloc = db_url.split("@")[-1].split("/")[0]
            if ":" in netloc:
                host, p = netloc.split(":")
                port = int(p)
            else:
                host = netloc
        except Exception as e:
            print(f"[!] Warning parsing DATABASE_URL: {e}")

    print(f"[*] Checking PostgreSQL readiness at {host}:{port}...")
    for attempt in range(1, max_retries + 1):
        try:
            with socket.create_connection((host, port), timeout=3):
                print(f"[+] PostgreSQL is ready at {host}:{port}!")
                return True
        except Exception as exc:
            print(f"[-] [{attempt}/{max_retries}] PostgreSQL not ready yet ({exc}). Waiting {retry_interval}s...")
            time.sleep(retry_interval)

    print("[!] Error: Could not connect to PostgreSQL within timeout period.")
    return False

if __name__ == "__main__":
    if not wait_for_postgres():
        sys.exit(1)
