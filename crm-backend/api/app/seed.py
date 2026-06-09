"""
Faker-based seed generator.

Run with:  python -m app.seed            (wipes + reseeds the 5 tables)
           python -m app.seed --keep     (skip wipe; only seed if empty)

Goal: produce data where AI-driven segments are MEANINGFUL. We do this by
assigning each customer a PERSONA that controls order count, spend, and recency,
so filters like "no order in 30 days" (lapsed) or "total_spend >= 5000" (VIP)
actually split the base into distinct, demo-able groups.

We deliberately do NOT store derived spend/recency on the customer — orders are
the source of truth and the segment compiler aggregates them at query time.
"""

import argparse
import random
from datetime import timedelta

from faker import Faker
from sqlmodel import Session, SQLModel, delete, select

from app.lib.db import engine, init_db
from app.models import Customer, Order, utcnow

# Indian locale → realistic names, cities, phone numbers for a DTC India brand.
fake = Faker("en_IN")
Faker.seed(42)      # deterministic data across runs (easier to demo/debug)
random.seed(42)

# Curated city pool (Faker en_IN cities are inconsistent; this keeps them clean).
CITIES = [
    "Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Chennai", "Kolkata",
    "Pune", "Ahmedabad", "Jaipur", "Surat", "Lucknow", "Kochi",
    "Indore", "Chandigarh", "Nagpur",
]

TAG_POOL = ["vip", "new", "lapsed", "discount_lover", "bulk_buyer", "loyalist"]

PRODUCTS = [
    ("TEE-01", "Cotton Tee", 499),
    ("HOOD-02", "Fleece Hoodie", 1299),
    ("JEAN-03", "Slim Jeans", 1999),
    ("SHOE-04", "Canvas Sneakers", 2499),
    ("CAP-05", "Baseball Cap", 399),
    ("JKT-06", "Bomber Jacket", 3499),
    ("SOCK-07", "Sock 3-Pack", 299),
    ("BAG-08", "Tote Bag", 899),
]

# Persona -> (weight, n_orders_range, recency_days_range, amount_multiplier)
# recency_days_range = how many days ago the customer's MOST RECENT order is.
PERSONAS = {
    "vip":     {"weight": 10, "orders": (6, 14), "recency": (0, 20),   "mult": (1.5, 2.5)},
    "lapsed":  {"weight": 25, "orders": (2, 6),  "recency": (35, 170), "mult": (0.8, 1.4)},
    "new":     {"weight": 15, "orders": (1, 1),  "recency": (0, 14),   "mult": (0.6, 1.2)},
    "regular": {"weight": 50, "orders": (2, 5),  "recency": (5, 60),   "mult": (0.8, 1.6)},
}


def _pick_persona() -> str:
    names = list(PERSONAS.keys())
    weights = [PERSONAS[n]["weight"] for n in names]
    return random.choices(names, weights=weights, k=1)[0]


def _tags_for(persona: str) -> list[str]:
    """Derive a couple of marketing tags loosely correlated with the persona."""
    tags: set[str] = set()
    if persona == "vip":
        tags.update(["vip", "loyalist"])
    if persona == "lapsed":
        tags.add("lapsed")
    if persona == "new":
        tags.add("new")
    # add 0-1 random flavour tag
    if random.random() < 0.4:
        tags.add(random.choice(["discount_lover", "bulk_buyer"]))
    return sorted(tags)


def _build_order(customer_id: int, most_recent_offset: int, is_most_recent: bool,
                 amount_mult: float) -> Order:
    """Create one order. The most-recent order sits at `most_recent_offset` days
    ago; older orders are pushed further back so recency is well-defined."""
    if is_most_recent:
        days_ago = most_recent_offset
    else:
        # older orders: somewhere between the recent offset and ~1 year back
        days_ago = random.randint(most_recent_offset + 1, most_recent_offset + 300)

    created = utcnow() - timedelta(days=days_ago, hours=random.randint(0, 23))

    # 1-3 line items
    line_items = []
    total = 0.0
    for _ in range(random.randint(1, 3)):
        sku, title, price = random.choice(PRODUCTS)
        qty = random.randint(1, 3)
        line_total = round(price * qty * amount_mult, 2)
        total += line_total
        line_items.append({"sku": sku, "title": title, "qty": qty,
                           "price": round(price * amount_mult, 2)})

    status = random.choices(
        ["DELIVERED", "PLACED", "RETURNED", "CANCELLED"],
        weights=[70, 18, 7, 5], k=1,
    )[0]

    return Order(
        customer_id=customer_id,
        amount=round(total, 2),
        items=line_items,
        status=status,
        created_at=created,
    )


def seed(n_customers: int = 500, keep: bool = False) -> None:
    init_db()

    with Session(engine) as session:
        existing = session.exec(select(Customer).limit(1)).first()
        if existing and keep:
            print("Data already present and --keep set; skipping seed.")
            return
        if existing and not keep:
            # Wipe in FK-safe order (children first).
            print("Wiping existing data...")
            for model in (Order, Customer):
                session.exec(delete(model))
            session.commit()

        persona_counts: dict[str, int] = {p: 0 for p in PERSONAS}
        total_orders = 0

        for _ in range(n_customers):
            persona = _pick_persona()
            persona_counts[persona] += 1
            cfg = PERSONAS[persona]

            customer = Customer(
                name=fake.name(),
                email=fake.unique.email(),
                phone=f"+91{random.randint(7000000000, 9999999999)}",
                city=random.choice(CITIES),
                tags=_tags_for(persona),
            )
            session.add(customer)
            session.flush()  # assign customer.id without a full commit

            recency = random.randint(*cfg["recency"])
            mult = random.uniform(*cfg["mult"])
            n_orders = random.randint(*cfg["orders"])

            for i in range(n_orders):
                order = _build_order(
                    customer_id=customer.id,
                    most_recent_offset=recency,
                    is_most_recent=(i == 0),
                    amount_mult=mult,
                )
                session.add(order)
                total_orders += 1

        session.commit()

    print("Seed complete.")
    print(f"  Customers: {n_customers}")
    print(f"  Orders:    {total_orders}")
    print("  Personas:  " + ", ".join(f"{k}={v}" for k, v in persona_counts.items()))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed PulseCRM with fake data.")
    parser.add_argument("--customers", type=int, default=500,
                        help="number of customers to generate (default 500)")
    parser.add_argument("--keep", action="store_true",
                        help="do not wipe; only seed if the DB is empty")
    args = parser.parse_args()
    seed(n_customers=args.customers, keep=args.keep)
