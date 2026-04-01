import requests
import json
from collections import defaultdict

# Output file path
OUTPUT_FILE = "generated_hardcoded_ranges.json"

# NHTSA API endpoints
MAKES_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/getallmakes?format=json"
MODELS_FOR_MAKE_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/{make}?format=json"
YEARS_FOR_MODEL_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/GetModelYearsForMakeModel/make/{make}/model/{model}?format=json"

# Only include these vehicle types
PASSENGER_TYPES = {"PASSENGER CAR", "MULTIPURPOSE PASSENGER VEHICLE (MPV)", "SPORT UTILITY VEHICLE (SUV)", "TRUCK"}

print("Fetching all makes from NHTSA...")
resp = requests.get(MAKES_URL)
resp.raise_for_status()
all_makes = resp.json()["Results"]

common_makes = set()
hardcoded_model_ranges = defaultdict(list)

for make_entry in all_makes:
    make = make_entry["Make_Name"].title()
    print(f"Processing make: {make}")
    models_resp = requests.get(MODELS_FOR_MAKE_URL.format(make=make))
    if models_resp.status_code != 200:
        continue
    models = models_resp.json()["Results"]
    for model_entry in models:
        model = model_entry["Model_Name"].title()
        vehicle_type = model_entry.get("VehicleTypeName", "").upper()
        if vehicle_type not in PASSENGER_TYPES:
            continue
        # Get years for this make/model
        years_resp = requests.get(YEARS_FOR_MODEL_URL.format(make=make, model=model))
        if years_resp.status_code != 200:
            continue
        years_data = years_resp.json().get("Results", [])
        years = [int(y["ModelYear"]) for y in years_data if y.get("ModelYear") and str(y["ModelYear"]).isdigit()]
        if not years:
            continue
        min_year, max_year = min(years), max(years)
        hardcoded_model_ranges[make].append({
            "model": model,
            "minYear": min_year,
            "maxYear": max_year
        })
        common_makes.add(make)

# Sort makes and models
common_makes = sorted(list(common_makes))
for make in hardcoded_model_ranges:
    hardcoded_model_ranges[make] = sorted(hardcoded_model_ranges[make], key=lambda x: x["model"])

# Output JSON
output = {
    "COMMON_MAKES": common_makes,
    "HARD_CODED_MODEL_RANGES": hardcoded_model_ranges
}

with open(OUTPUT_FILE, "w") as f:
    json.dump(output, f, indent=2)

print(f"Done! Output written to {OUTPUT_FILE}")
