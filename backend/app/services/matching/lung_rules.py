from app.models.donor import Donor
from app.models.recipient import Recipient

def check_lung_eligibility(donor: Donor, recipient: Recipient) -> bool:
    """
    Evaluates lung matching constraints. Enforces donor-recipient height difference < 10%
    (since lung capacity correlates strongly with patient height).
    """
    donor_height = donor.medical_details.get("height_cm")
    recipient_height = recipient.medical_details.get("height_cm")

    if donor_height is not None and recipient_height is not None:
        try:
            d_ht = float(donor_height)
            r_ht = float(recipient_height)
            if d_ht > 0:
                diff_pct = abs(d_ht - r_ht) / d_ht
                if diff_pct > 0.10:
                    return False
        except (ValueError, TypeError):
            pass

    return True
