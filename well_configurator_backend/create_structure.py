import os

dirs = [
    "api",
    "core",
    "rule_engine",
    "optimizer",
    "configuration_generator",
    "validator",
    "ml",
    "database",
    "sync",
    "data",
    "tests"
]

files = [
    "__init__.py",
    "api/__init__.py", "api/main.py", "api/endpoints.py", "api/schemas.py",
    "core/__init__.py", "core/config.py", "core/models.py",
    "rule_engine/__init__.py", "rule_engine/rules.py",
    "optimizer/__init__.py", "optimizer/cp_optimizer.py",
    "configuration_generator/__init__.py", "configuration_generator/generator.py",
    "validator/__init__.py", "validator/validator.py",
    "ml/__init__.py", "ml/ranker.py",
    "database/__init__.py", "database/local_db.py", "database/central_db.py", "database/crud.py", "database/tables.py",
    "sync/__init__.py", "sync/sync_manager.py",
    "data/__init__.py", "data/seed.py",
    "tests/__init__.py", "tests/test_basic.py",
    "requirements.txt",
    "README.md",
    "run.py"
]

root = "g:/GitHub/Oferty_PV/well_configurator_backend"

for d in dirs:
    os.makedirs(os.path.join(root, d), exist_ok=True)

for f in files:
    open(os.path.join(root, f), 'a').close()

print("Project structure created successfully.")
