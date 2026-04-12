from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv
import os
import time

load_dotenv()

SQLALCHEMY_DATABASE_URL = os.environ.get("POSTGRES_URI")

def create_engine_with_retry(url, retries=5, delay=3):
    for attempt in range(retries):
        try:
            engine = create_engine(
                url,
                pool_pre_ping=True, 
                pool_recycle=300,
                connect_args={
                    "connect_timeout": 10,
                },
            )
            # test the connection
            with engine.connect():
                pass
            return engine
        except Exception as e:
            print(f"DB connection attempt {attempt + 1} failed: {e}")
            if attempt < retries - 1:
                time.sleep(delay)
    raise Exception("Could not connect to the database after multiple retries")

engine = create_engine_with_retry(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_table():
    Base.metadata.create_all(bind=engine)