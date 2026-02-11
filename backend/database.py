from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine

DATABASE_URL = "sqlite:///./experiment.db"
engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False} #Tells SQLite "It's okay for different workers/threads to use the same database connection."
)
session=sessionmaker(autocommit=False,autoflush=False,bind=engine)