from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class ServiceHealthStatus(BaseModel):
    service: str
    status: str  # HEALTHY, DEGRADED, DOWN, NOT_CONFIGURED
    latency_ms: Optional[float] = None
    last_checked: datetime
    message: Optional[str] = None
    details: Optional[Dict[str, Any]] = None

class SystemHealthResponse(BaseModel):
    overall_status: str  # HEALTHY, DEGRADED, DOWN
    last_checked: datetime
    backend_response_time_ms: float
    database_response_time_ms: float
    active_users_count: int
    recent_errors_count: int
    active_security_events_count: int
    services: List[ServiceHealthStatus]

class PostgresqlMonitoringResponse(BaseModel):
    status: str
    version: str
    database_name: str
    host: str
    port: int
    database_size_bytes: int
    database_size_human: str
    number_of_tables: int
    active_connections: int
    idle_connections: int
    max_connections: int
    response_time_ms: float
    last_checked: datetime

class TableMetric(BaseModel):
    table_name: str
    approximate_row_count: int
    total_size_bytes: int
    total_size_human: str
    last_checked: datetime

class DatabaseTablesResponse(BaseModel):
    tables: List[TableMetric]
    total_tables: int
    total_database_size_human: str
    last_checked: datetime

class BackendMonitoringResponse(BaseModel):
    status: str
    api_version: str
    fastapi_version: str
    python_version: str
    uptime_seconds: float
    response_time_ms: float
    total_requests_count: int
    responses_2xx_count: int
    responses_4xx_count: int
    responses_5xx_count: int
    recent_errors: List[Dict[str, Any]]
    last_checked: datetime

class AuthMonitoringResponse(BaseModel):
    jwt_status: str
    access_token_service_status: str
    refresh_token_service_status: str
    active_users: int
    failed_login_attempts: int
    locked_accounts: int
    recent_auth_errors: List[Dict[str, Any]]
    last_checked: datetime

class DockerContainerStatus(BaseModel):
    container_name: str
    service_name: str
    status: str  # running, exited, paused, NOT_CONFIGURED
    uptime: Optional[str] = None
    health: Optional[str] = None
    restart_count: int = 0

class DockerMonitoringResponse(BaseModel):
    service: str = "docker"
    status: str  # HEALTHY, DEGRADED, OFFLINE, NOT_AVAILABLE, NOT_CONFIGURED
    docker_status: str = "NOT_AVAILABLE"
    configured: bool = False
    available: bool = False
    daemon_connected: bool = False
    docker_version: Optional[str] = None
    running_containers: int = 0
    stopped_containers: int = 0
    total_containers: int = 0
    message: str
    containers: List[DockerContainerStatus] = Field(default_factory=list)
    checked_at: datetime
    last_checked: datetime

class BlockchainMonitoringResponse(BaseModel):
    service: str = "hyperledger_fabric"
    status: str  # HEALTHY, DEGRADED, OFFLINE, NOT_CONFIGURED
    configured: bool = False
    connected: bool = False
    network_reachable: bool = False
    is_live_network: bool = False
    peer_status: str = "NOT_CONFIGURED"
    orderer_status: str = "NOT_CONFIGURED"
    peer_endpoint: Optional[str] = None
    orderer_endpoint: Optional[str] = None
    message: str
    network: str
    channel: str
    chaincode: str
    chaincode_status: Optional[str] = "NOT_CONFIGURED"
    latest_block: Optional[int] = None
    last_known_block: Optional[int] = None
    last_synced_at: Optional[datetime] = None
    transaction_count: int = 0
    local_transaction_count: int = 0
    failed_transactions: int = 0
    last_successful_tx: Optional[datetime] = None
    last_verification: Optional[datetime] = None
    checked_at: datetime
    last_checked: datetime

class UnifiedServiceHealthItem(BaseModel):
    name: str
    type: str  # docker, fabric, database, backend, auth
    status: str  # HEALTHY, DEGRADED, OFFLINE, NOT_AVAILABLE, NOT_CONFIGURED, DOWN
    message: str
    latency_ms: Optional[float] = None
    metrics: Dict[str, Any] = Field(default_factory=dict)
    checked_at: datetime

class ServicesMonitoringResponse(BaseModel):
    services: List[UnifiedServiceHealthItem]
    overall_status: str
    checked_at: datetime

class ApiActivityItem(BaseModel):
    id: str
    timestamp: datetime
    method: str
    endpoint: str
    status_code: int
    response_time_ms: Optional[float] = None
    username: str
    role: str
    request_id: Optional[str] = None

class ApiActivityResponse(BaseModel):
    items: List[ApiActivityItem]
    total: int
    last_checked: datetime

class ErrorLogItem(BaseModel):
    id: str
    timestamp: datetime
    service: str
    endpoint: Optional[str] = None
    status_code: Optional[int] = None
    error_type: str
    reason: str
    request_id: Optional[str] = None
    username: Optional[str] = None
    resolution_status: str

class ErrorLogsResponse(BaseModel):
    items: List[ErrorLogItem]
    total: int
    last_checked: datetime

class SecurityHealthResponse(BaseModel):
    status: str
    failed_logins_count: int
    locked_accounts_count: int
    unauthorized_attempts_count: int
    recent_security_events_count: int
    open_tampering_alerts_count: int
    auth_failures_count: int
    last_checked: datetime
