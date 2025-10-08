from motor.motor_asyncio import AsyncIOMotorClient
from .config import settings

class Database:
    """
    Database connection manager using MongoDB with async support.
    """
    client: AsyncIOMotorClient = None
    db = None

# Global database instance
db = Database()

async def connect_to_mongo():
    """
    Establish connection to MongoDB when the application starts.
    """
    print("Connecting to MongoDB...")
    db.client = AsyncIOMotorClient(settings.mongodb_url)
    db.db = db.client[settings.database_name]
    
    # Test the connection
    try:
        await db.client.admin.command('ping')
        print(f"✓ Connected to MongoDB: {settings.database_name}")
    except Exception as e:
        print(f"✗ Failed to connect to MongoDB: {e}")
        raise

async def close_mongo_connection():
    """
    Close MongoDB connection when the application shuts down.
    """
    print("Closing MongoDB connection...")
    db.client.close()
    print("✓ MongoDB connection closed")

def get_database():
    """
    Get the database instance for use in route handlers.
    """
    return db.db