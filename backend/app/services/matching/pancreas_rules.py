from app.models.donor import Donor
from app.models.recipient import Recipient

def check_pancreas_eligibility(donor: Donor, recipient: Recipient) -> bool:
    """
    Evaluates pancreas matching constraints. Checks recipient BMI levels (enforces BMI < 32
    to exclude cases with advanced insulin resistance/type 2 markers).
    """
    recipient_bmi = recipient.medical_details.get("bmi")
    if recipient_bmi is not None:
        try:
            bmi = float(recipient_bmi)
            if bmi >= 32.0:
                return False
        except (ValueError, TypeError):
            pass

    return True
