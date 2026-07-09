"""Bounce backend API tests (pytest).
Assumes a test user + session already seeded in Mongo (see /app/auth_testing.md).
Token/user id are passed via env or the fixtures below auto-seed if missing.
"""
import os
import time
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Read from frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


@pytest.fixture(scope="session")
def mongo_db():
    c = MongoClient(MONGO_URL)
    return c[DB_NAME]


@pytest.fixture(scope="session")
def seeded(mongo_db):
    uid = f"user_test{int(time.time()*1000)}"
    token = f"test_session_{int(time.time()*1000)}"
    mongo_db.users.insert_one({
        "user_id": uid, "email": "pytest.user@example.com", "name": "Pytest",
        "picture": "", "provider": "google",
        "created_at": "2026-01-01T00:00:00",
    })
    for n in ["Startup", "Marketing", "Research", "Coding", "Personal"]:
        mongo_db.folders.insert_one({
            "folder_id": f"fld_{n.lower()}_{uid[-6:]}",
            "user_id": uid, "name": n,
            "created_at": "2026-01-01T00:00:00",
        })
    mongo_db.user_sessions.insert_one({
        "user_id": uid, "session_token": token,
        "expires_at": "2099-01-01T00:00:00",
        "created_at": "2026-01-01T00:00:00",
    })
    yield {"user_id": uid, "token": token}
    # cleanup
    mongo_db.users.delete_many({"user_id": uid})
    mongo_db.folders.delete_many({"user_id": uid})
    mongo_db.memories.delete_many({"user_id": uid})
    mongo_db.deployments.delete_many({"user_id": uid})
    mongo_db.user_sessions.delete_many({"user_id": uid})


@pytest.fixture(scope="session")
def client(seeded):
    s = requests.Session()
    s.headers.update({
        "Authorization": f"Bearer {seeded['token']}",
        "Content-Type": "application/json",
    })
    return s


# ---------------- Auth ----------------
class TestAuth:
    def test_me_ok(self, client):
        r = client.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == "pytest.user@example.com"
        assert d["provider"] == "google"

    def test_me_no_token(self):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401

    def test_me_invalid_token(self):
        r = requests.get(f"{BASE_URL}/api/auth/me",
                         headers={"Authorization": "Bearer bogus_token_xyz"})
        assert r.status_code == 401


# ---------------- Folders ----------------
class TestFolders:
    def test_default_folders(self, client):
        r = client.get(f"{BASE_URL}/api/folders")
        assert r.status_code == 200
        names = sorted(f["name"] for f in r.json())
        assert names == sorted(["Startup", "Marketing", "Research", "Coding", "Personal"])
        for f in r.json():
            assert "folder_id" in f and "memory_count" in f

    def test_create_folder(self, client):
        r = client.post(f"{BASE_URL}/api/folders", json={"name": "TEST_NewFolder"})
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_NewFolder"
        # confirm listed
        r2 = client.get(f"{BASE_URL}/api/folders")
        assert any(f["name"] == "TEST_NewFolder" for f in r2.json())


# ---------------- Memory pipeline ----------------
class TestMemory:
    CONV = ("User: I'm building a React todo app with FastAPI backend. "
            "Assistant: Use JWT for auth. Decisions: use MongoDB. "
            "TODO: add dark mode. Technologies: React, FastAPI, MongoDB.")

    def test_save_with_folder_id(self, client):
        folders = client.get(f"{BASE_URL}/api/folders").json()
        coding = next(f for f in folders if f["name"] == "Coding")
        r = client.post(f"{BASE_URL}/api/memory/save",
                        json={"conversation": self.CONV, "folder_id": coding["folder_id"]})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "memory" in d
        s = d["memory"]["structured"]
        # LLM may partially fill; treat filled structured as success
        assert isinstance(s, dict)
        assert any(k in s for k in ("goal", "decisions", "todos", "technologies", "summary"))
        # Save memory_id for later
        pytest.saved_memory_id = d["memory"]["memory_id"]
        pytest.saved_folder_id = coding["folder_id"]

    def test_save_with_folder_name_creates(self, client):
        r = client.post(f"{BASE_URL}/api/memory/save",
                        json={"conversation": self.CONV, "folder_name": "TEST_AutoCreated"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["folder"]["name"] == "TEST_AutoCreated"

    def test_search(self, client):
        r = client.post(f"{BASE_URL}/api/memory/search", json={"query": "react fastapi"})
        assert r.status_code == 200
        d = r.json()
        assert "results" in d
        # Should have at least the one we saved
        if d["results"]:
            assert "score" in d["results"][0]

    def test_deploy(self, client):
        r = client.post(f"{BASE_URL}/api/memory/deploy",
                        json={"folder_id": pytest.saved_folder_id})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "<context>" in d["context"]
        assert d["memory_count"] > 0

    def test_deploy_empty_folder(self, client):
        # Create empty folder
        r = client.post(f"{BASE_URL}/api/folders", json={"name": "TEST_EmptyDeploy"})
        fid = r.json()["folder_id"]
        r2 = client.post(f"{BASE_URL}/api/memory/deploy", json={"folder_id": fid})
        assert r2.status_code == 400

    def test_merge(self, client):
        # Add a second memory in the same folder
        r = client.post(f"{BASE_URL}/api/memory/save",
                        json={"conversation": "Decision: use Tailwind. TODO: add tests. Tech: Tailwind.",
                              "folder_id": pytest.saved_folder_id})
        assert r.status_code == 200
        mid2 = r.json()["memory"]["memory_id"]
        r2 = client.post(f"{BASE_URL}/api/memory/merge",
                         json={"folder_id": pytest.saved_folder_id,
                               "memory_ids": [pytest.saved_memory_id, mid2]})
        assert r2.status_code == 200, r2.text
        assert "memory" in r2.json()

    def test_recent(self, client):
        r = client.get(f"{BASE_URL}/api/recent")
        assert r.status_code == 200
        d = r.json()
        assert "recent" in d
        assert len(d["recent"]) > 0
        assert "folder_name" in d["recent"][0]

    def test_deployments(self, client):
        r = client.get(f"{BASE_URL}/api/deployments")
        assert r.status_code == 200
        assert "deployments" in r.json()

    def test_delete_memory(self, client):
        # save then delete
        r = client.post(f"{BASE_URL}/api/memory/save",
                        json={"conversation": "TODO: delete me.", "folder_id": pytest.saved_folder_id})
        mid = r.json()["memory"]["memory_id"]
        r2 = client.delete(f"{BASE_URL}/api/memory/{mid}")
        assert r2.status_code == 200
        r3 = client.get(f"{BASE_URL}/api/memory/{mid}")
        assert r3.status_code == 404


class TestOptimize:
    def test_optimize(self, client):
        r = client.post(f"{BASE_URL}/api/optimize",
                        json={"prompt": "write a haiku about databases"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "optimized" in d and isinstance(d["optimized"], str)
        assert len(d["optimized"]) > 0
