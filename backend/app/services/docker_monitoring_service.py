import logging
import subprocess
import re
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any

from app.schemas.system_monitoring import DockerContainerStatus

logger = logging.getLogger("docker_monitoring")

class DockerMonitoringService:
    """
    Real-time Docker runtime discovery and health check service.
    Evaluates Docker daemon connectivity, ping response, and active container metrics.
    Accurately distinguishes between HEALTHY, DEGRADED, OFFLINE, and NOT_AVAILABLE.
    """

    def check_status(self) -> Dict[str, Any]:
        now_utc = datetime.now(timezone.utc)
        containers: List[DockerContainerStatus] = []
        daemon_connected = False
        docker_version: Optional[str] = None
        status = "NOT_AVAILABLE"
        message = "Docker socket or CLI is not accessible from the backend environment"

        logger.info("[MONITORING] Starting real-time Docker runtime discovery...")

        # 1. Attempt connection via Docker Python SDK across standard Windows and Unix endpoints
        endpoints_to_try = [
            None,  # from_env default
            "npipe:////./pipe/docker_engine",
            "tcp://127.0.0.1:2375",
        ]

        try:
            import docker
            for ep in endpoints_to_try:
                try:
                    client = docker.DockerClient(base_url=ep, timeout=1.0) if ep else docker.from_env(timeout=1.0)
                    if client.ping():
                        daemon_connected = True
                        logger.info(f"[MONITORING] Docker SDK successfully connected via endpoint: {ep or 'from_env'}")
                        try:
                            ver_info = client.version()
                            docker_version = ver_info.get("Version", "Connected")
                        except Exception:
                            docker_version = "Connected"

                        # Retrieve containers
                        raw_containers = client.containers.list(all=True)
                        for c in raw_containers:
                            c_name = c.name.lstrip("/")
                            c_status = c.status.upper() if c.status else "UNKNOWN"
                            service_name = c_name.replace("organmatch-", "").replace("organ_", "")
                            health_status = "healthy" if c_status == "RUNNING" else "stopped"
                            uptime = None
                            try:
                                state = (c.attrs or {}).get("State", {})
                                if "StartedAt" in state:
                                    uptime = state.get("StartedAt")[:19].replace("T", " ")
                            except Exception:
                                pass

                            containers.append(DockerContainerStatus(
                                container_name=c_name,
                                service_name=service_name,
                                status=c_status,
                                uptime=uptime,
                                health=health_status,
                                restart_count=0
                            ))
                        break
                except Exception as sdk_ep_err:
                    logger.warning(f"[MONITORING] Docker endpoint '{ep or 'default'}' connection failed: {sdk_ep_err}")
        except ImportError as imp_err:
            logger.warning(f"[MONITORING] python docker package not imported: {imp_err}")


        # 2. If SDK failed to reach daemon, test Docker CLI
        if not daemon_connected:
            try:
                # Attempt to query server version via CLI
                info_res = subprocess.run(
                    ["docker", "info", "--format", "{{.ServerVersion}}"],
                    capture_output=True, text=True, timeout=1.5
                )
                if info_res.returncode == 0 and info_res.stdout.strip():
                    daemon_connected = True
                    docker_version = info_res.stdout.strip()
                    logger.info(f"[MONITORING] Docker CLI successfully connected to daemon (v{docker_version})")

                    # Query all containers via CLI
                    ps_res = subprocess.run(
                        ["docker", "ps", "-a", "--format", "{{.Names}}\t{{.Status}}\t{{.RunningFor}}\t{{.State}}"],
                        capture_output=True, text=True, timeout=1.5
                    )
                    if ps_res.returncode == 0 and ps_res.stdout.strip():
                        for line in ps_res.stdout.strip().splitlines():
                            if not line:
                                continue
                            parts = line.split("\t")
                            name = parts[0] if len(parts) > 0 else "container"
                            status_text = parts[1] if len(parts) > 1 else "unknown"
                            uptime = parts[2] if len(parts) > 2 else None
                            state_raw = parts[3].upper() if len(parts) > 3 else ("RUNNING" if "up" in status_text.lower() else "EXITED")
                            service = name.replace("organmatch-", "").replace("organ_", "")

                            containers.append(DockerContainerStatus(
                                container_name=name,
                                service_name=service,
                                status=state_raw,
                                uptime=uptime,
                                health="healthy" if state_raw == "RUNNING" else "stopped",
                                restart_count=0
                            ))
                else:
                    # Check if Docker client is installed even if daemon is stopped
                    ver_res = subprocess.run(
                        ["docker", "version", "--format", "{{.Client.Version}}"],
                        capture_output=True, text=True, timeout=1.5
                    )
                    client_ver = ver_res.stdout.strip()
                    if client_ver and re.match(r"^\d+\.\d+", client_ver):
                        docker_version = client_ver
                        status = "OFFLINE"
                        message = f"Docker Desktop CLI is installed (v{client_ver}), but the engine daemon is currently stopped / offline"
                        logger.warning(f"[MONITORING] Docker client v{client_ver} found, but engine daemon is offline.")
                    else:
                        status = "OFFLINE"
                        message = "Docker is installed on host, but the daemon is not running or socket is unreachable"
            except FileNotFoundError:
                status = "NOT_AVAILABLE"
                message = "Docker CLI and SDK are not installed in this environment"
                logger.info("[MONITORING] Docker executable not found in host PATH.")
            except Exception as cli_err:
                status = "OFFLINE"
                message = f"Docker daemon unreachable: {str(cli_err)[:80]}"
                logger.warning(f"[MONITORING] Docker CLI check error: {cli_err}")

        # 3. Calculate status and counts
        running_count = sum(1 for c in containers if c.status in ["RUNNING", "RUNNING (HEALTHY)"])
        stopped_count = sum(1 for c in containers if c.status not in ["RUNNING", "RUNNING (HEALTHY)"])
        total_count = len(containers)

        if daemon_connected:
            if running_count > 0 or total_count == 0:
                status = "HEALTHY"
                message = f"Docker daemon connected successfully (v{docker_version})" if docker_version else "Docker daemon is running and reachable"
            else:
                status = "DEGRADED"
                message = "Docker daemon is connected, but containers are currently stopped"


        logger.info(
            f"[MONITORING] Docker check complete — Status: {status}, "
            f"Running: {running_count}, Stopped: {stopped_count}, Total: {total_count}"
        )

        return {
            "service": "docker",
            "status": status,
            "message": message,
            "daemon_connected": daemon_connected,
            "docker_version": docker_version,
            "running_containers": running_count,
            "stopped_containers": stopped_count,
            "total_containers": total_count,
            "containers": containers,
            "checked_at": now_utc,
        }

docker_monitoring_service = DockerMonitoringService()
