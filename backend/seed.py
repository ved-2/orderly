"""Backward-compatible database seed entry point.

Run from the backend directory with: python seed.py
"""

from app.scripts.seed_catalogue import seed_catalogue
from app.scripts.seed_inventory import seed_inventory
from app.scripts.seed_salesmen_and_beats import seed_salesmen_and_beats


if __name__ == "__main__":
    print(f"Catalogue: {seed_catalogue()} new products")
    print(f"Inventory: {seed_inventory()} new stock records")
    seed_salesmen_and_beats()
