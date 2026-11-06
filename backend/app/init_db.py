import logging
import time
from sqlalchemy import inspect, text
from sqlalchemy.exc import OperationalError

from app.core.database import Base, engine, init_db

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def wait_for_db(max_retries: int = 10, retry_interval: float = 2.0) -> None:
    """Wait until PostgreSQL database is ready to accept connections."""
    for attempt in range(1, max_retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            logger.info("PostgreSQL connection established.")
            return
        except OperationalError as exc:
            logger.warning(
                "Waiting for PostgreSQL (attempt %d/%d): %s",
                attempt,
                max_retries,
                exc,
            )
            if attempt == max_retries:
                raise
            time.sleep(retry_interval)


def main() -> None:
    """Connect to PostgreSQL and create all tables from SQLAlchemy 2.0 models."""
    logger.info("Connecting to PostgreSQL and initializing schema...")
    wait_for_db()
    init_db()

    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    model_tables = list(Base.metadata.tables.keys())
    logger.info("Target model tables: %s", model_tables)
    logger.info("Current tables in PostgreSQL: %s", existing_tables)
    logger.info("Database table creation completed successfully.")


if __name__ == "__main__":
    main()
