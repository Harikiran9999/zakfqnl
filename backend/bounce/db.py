import os
from motor.motor_asyncio import AsyncIOMotorClient

_client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = _client[os.environ["DB_NAME"]]

users = db.users
sessions = db.user_sessions
folders = db.folders
memories = db.memories
deployments = db.deployments

DEFAULT_FOLDERS = ["Startup", "Marketing", "Research", "Coding", "Personal"]


def close():
    _client.close()
