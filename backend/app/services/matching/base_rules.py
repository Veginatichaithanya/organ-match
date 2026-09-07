from typing import List, Set

# Blood Compatibility Rules Map: Donor Blood Group -> Allowed Recipient Blood Groups
BLOOD_COMPATIBILITY_MAP = {
    "O-": ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"],
    "O+": ["O+", "A+", "B+", "AB+"],
    "A-": ["A+", "A-", "AB+", "AB-"],
    "A+": ["A+", "AB+"],
    "B-": ["B+", "B-", "AB+", "AB-"],
    "B+": ["B+", "AB+"],
    "AB-": ["AB+", "AB-"],
    "AB+": ["AB+"]
}

def is_blood_compatible(donor_blood: str, recipient_blood: str) -> bool:
    """
    Checks if a donor's blood type can be safely received by the recipient.
    """
    allowed_recipients = BLOOD_COMPATIBILITY_MAP.get(donor_blood, [])
    return recipient_blood in allowed_recipients

def parse_alleles(hla_data: dict) -> Set[str]:
    """
    Parses HLA typing dictionaries into a flat set of string alleles.
    Supports formats like {"A": "02,03", "B": "07,44"} or {"alleles": ["A2", "B7"]}
    """
    alleles = set()
    if not hla_data:
        return alleles

    # Check for direct alleles list
    if "alleles" in hla_data and isinstance(hla_data["alleles"], list):
        return set(str(a).strip().upper() for a in hla_data["alleles"])

    # Check for loci dict
    for locus, val in hla_data.items():
        if isinstance(val, str):
            for part in val.split(","):
                part_clean = part.strip().upper()
                if part_clean:
                    alleles.add(f"{locus.upper()}_{part_clean}")
        elif isinstance(val, list):
            for part in val:
                part_clean = str(part).strip().upper()
                if part_clean:
                    alleles.add(f"{locus.upper()}_{part_clean}")
    return alleles

def count_shared_hla(donor_hla: dict, recipient_hla: dict) -> int:
    """
    Returns the count of matching HLA alleles between donor and recipient.
    """
    donor_set = parse_alleles(donor_hla)
    recipient_set = parse_alleles(recipient_hla)
    if not donor_set or not recipient_set:
        return 0
    return len(donor_set.intersection(recipient_set))
