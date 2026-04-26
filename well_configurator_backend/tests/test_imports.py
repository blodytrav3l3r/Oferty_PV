import sys
sys.path.insert(0, r'g:\GitHub\Oferty_PV\well_configurator_backend')

from api.schemas import WellConfigInput, AvailableProduct
from rule_engine.rules import RuleEngine, get_default_clearance
from configuration_generator.generator import ConfigurationGenerator
from optimizer.cp_optimizer import optimize_rings_for_distance
from validator.validator import validate_transitions, substitute_ot_rings

print("OK: all imports work")

# Test alias
import pydantic
w = WellConfigInput(dn=1000, target_height_mm=3000, redukcja_min_h_mm=2000)
print(f"redukcjaMinH = {w.redukcjaMinH}")
assert w.redukcjaMinH == 2000.0

# Test target_dn
w2 = WellConfigInput(dn=1500, target_height_mm=3000, target_dn=1200, use_reduction=True)
print(f"target_dn = {w2.target_dn}")
assert w2.target_dn == 1200

print("OK: all tests passed")
