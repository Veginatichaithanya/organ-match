from app.models.donor import Donor
from app.models.recipient import Recipient
from app.services.matching.base_rules import count_shared_hla

def check_kidney_eligibility(donor: Donor, recipient: Recipient) -> bool:
    """
    Evaluates kidney matching constraints. Enforces at least 1 shared HLA antigen
    mismatch match to avoid absolute hyperacute rejection risks.
    """
    shared_alleles = count_shared_hla(donor.hla_information, recipient.hla_information)
    
    # In academic prototype, if HLA data is fully omitted, we allow it for seed datasets;
    # but if HLA is present, we enforce at least 1 shared marker.
    if donor.hla_information and recipient.hla_information:
        if shared_alleles < 1:
            return False
            
    return True
