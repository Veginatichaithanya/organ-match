# Import all models to register them on the metadata Base before migrations run
from app.models.base import Base
from app.models.hospital import Hospital
from app.models.user import User, Role, Permission, role_permissions, user_roles
from app.models.donor import Donor
from app.models.organ import Organ
from app.models.recipient import Recipient
from app.models.match import Match
from app.models.blockchain_transaction import BlockchainTransaction
from app.models.system_setting import SystemSetting
from app.models.medical_assessment import MedicalAssessment
from app.models.audit import AuditLog
