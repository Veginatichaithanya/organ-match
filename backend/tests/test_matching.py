import pytest
from app.models.donor import Donor
from app.models.recipient import Recipient
from app.models.organ import Organ
from app.services.matching.heart_rules import check_heart_eligibility
from app.services.matching_service import MatchingService

def test_heart_eligibility_weight_ratio():
    """
    Verifies that heart matching eligibility rejects matches if weight difference is > 15%.
    """
    donor = Donor(medical_details={"weight_kg": 80.0})
    
    # Within 15% (e.g. 72 kg is 10% diff) -> Should pass
    rec_ok = Recipient(medical_details={"weight_kg": 72.0})
    assert check_heart_eligibility(donor, rec_ok) is True

    # Exceeding 15% (e.g. 64 kg is 20% diff) -> Should fail
    rec_bad = Recipient(medical_details={"weight_kg": 64.0})
    assert check_heart_eligibility(donor, rec_bad) is False

def test_scoring_weights_blood_group():
    """
    Verifies Stage 2 weighted scores conform to matching specifications.
    Weights: 25% blood, 30% medical, 25% HLA, 20% priority.
    """
    # 1. Exact blood type match (O+)
    organ = Organ(blood_group="O+", organ_type="HEART")
    donor = Donor(age=30, hla_information={"A": "02", "B": "07", "DR": "04"}, medical_details={})
    
    recipient_exact = Recipient(
        blood_group="O+",
        age=30,
        hla_information={"A": "02", "B": "07", "DR": "04"},
        medical_details={"suitability_score": 100},
        urgency="CRITICAL"
    )
    
    score_exact, breakdown_exact = MatchingService.calculate_score(organ, donor, recipient_exact)
    
    # Blood score component: exact match gets full 25 points
    assert breakdown_exact["blood"] == 25
    # Urgency score component: Critical gets full 20 points
    assert breakdown_exact["priority"] == 20
    # Total score should be 100 (25 blood + 30 med + 25 HLA + 20 priority)
    assert score_exact == 100

    # 2. Compatible but different blood type (O- organ giving to A+ recipient)
    organ_o_minus = Organ(blood_group="O-", organ_type="HEART")
    recipient_diff = Recipient(
        blood_group="A+",
        age=30,
        hla_information={"A": "02"},
        medical_details={"suitability_score": 100},
        urgency="CRITICAL"
    )
    
    score_diff, breakdown_diff = MatchingService.calculate_score(organ_o_minus, donor, recipient_diff)
    
    # Compatible but different gets 50% points * 25% weight = 12.5 points (rounds to 12)
    assert breakdown_diff["blood"] == 12
    assert score_diff < 100
