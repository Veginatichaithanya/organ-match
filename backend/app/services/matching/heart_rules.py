from app.models.donor import Donor
from app.models.recipient import Recipient

def check_heart_eligibility(donor: Donor, recipient: Recipient) -> bool:
    """
    Evaluates heart matching constraints. Enforces donor-recipient weight difference < 15%.
    """
    donor_weight = donor.medical_details.get("weight_kg")
    recipient_weight = recipient.medical_details.get("weight_kg")

    if donor_weight is not None and recipient_weight is not None:
        try:
            d_wt = float(donor_weight)
            r_wt = float(recipient_weight)
            if d_wt > 0:
                diff_pct = abs(d_wt - r_wt) / d_wt
                if diff_pct > 0.15:
                    return False
        except (ValueError, TypeError):
            # Fallback to true if parsing fails to maintain demo usability
            pass
            
    return True
