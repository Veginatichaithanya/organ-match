import time
import platform
import logging
from datetime import datetime, timezone
from typing import Dict, Any

logger = logging.getLogger("backend_monitoring")

class BackendMonitoringService:
    """
    Real-time FastAPI application runtime health, uptime, and request counters service.
    """

    def __init__(self):
        self.app_start_time = datetime.now(timezone.utc)

    def check_status(self, request_counters: Dict[str, int]) -> Dict[str, Any]:
        now_utc = datetime.now(timezone.utc)
        start_t = time.perf_counter()

        uptime_seconds = int((now_utc - self.app_start_time).total_seconds())
        days, rem = divmod(uptime_seconds, 86400)
        hours, rem = divmod(rem, 3600)
        minutes, secs = divmod(rem, 60)
        uptime_str = f"{days}d {hours}h {minutes}m {secs}s" if days > 0 else f"{hours}h {minutes}m {secs}s"

        response_latency_ms = round((time.perf_counter() - start_t) * 1000, 2)
        total_requests = request_counters.get("total", 0)

        message = (
            f"FastAPI router operational ({total_requests} requests served)"
            if total_requests > 0
            else "FastAPI router operational"
        )

        return {
            "service": "backend",
            "status": "HEALTHY",
            "message": message,
            "latency_ms": response_latency_ms,
            "uptime": uptime_str,
            "total_requests": total_requests,
            "python_version": platform.python_version(),
            "checked_at": now_utc,
        }

backend_monitoring_service = BackendMonitoringService()
