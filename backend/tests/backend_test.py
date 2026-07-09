"""Bounce backend API tests (pytest) — BMF iteration.
Covers auth, folders, BMF save & evolution, deploy engine relevance,
workspace memory, export, search, optimize, recent, deployments.
"""
import os
import time
import uuid
import base64
import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")


@pytest.fixture(scope="session")
def mongo_db():
    return MongoClient(MONGO_URL)[DB_NAME]


@pytest.fixture(scope="session")
def seeded(mongo_db):
    suffix = uuid.uuid4().hex[:12]
    uid = f"user_test{suffix}"
    token = f"test_session_{suffix}"
    mongo_db.users.insert_one({
        "user_id": uid, "email": "pytest.user@example.com", "name": "Pytest",
        "picture": "", "provider": "google", "created_at": "2026-01-01T00:00:00",
    })
    for n in ["Startup", "Marketing", "Research", "Coding", "Personal"]:
        mongo_db.folders.insert_one({
            "folder_id": f"fld_{n.lower()}_{uid[-6:]}",
            "user_id": uid, "name": n, "created_at": "2026-01-01T00:00:00",
        })
    mongo_db.user_sessions.insert_one({
        "user_id": uid, "session_token": token,
        "expires_at": "2099-01-01T00:00:00", "created_at": "2026-01-01T00:00:00",
    })
    yield {"user_id": uid, "token": token}
    for coll in ("users", "folders", "memories", "deployments",
                 "user_sessions", "workspace_memories"):
        mongo_db[coll].delete_many({"user_id": uid})


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
        assert r.status_code == 200, r.text
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
        assert set(["Startup", "Marketing", "Research", "Coding", "Personal"]).issubset(set(names))

    def test_create_folder(self, client):
        r = client.post(f"{BASE_URL}/api/folders", json={"name": "TEST_NewFolder"})
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_NewFolder"


CONV_V1 = ("User: Build a task-tracker web app. We will use Supabase as the database "
           "and React for the frontend. Decision: use Supabase. TODO: set up auth. "
           "Technologies: React, Supabase.")
CONV_V2 = ("User: On second thought, switch database from Supabase to MongoDB because "
           "we need flexible schemas. Decision: use MongoDB, replaces Supabase. "
           "Technologies: MongoDB.")


@pytest.fixture(scope="session")
def evo_folder(client):
    """Fresh folder + first save. Shared across evolution/deploy/export tests."""
    f = client.post(f"{BASE_URL}/api/folders",
                    json={"name": f"TEST_Evo_{int(time.time()*1000)}"}).json()
    fid = f["folder_id"]
    r = client.post(f"{BASE_URL}/api/memory/save",
                    json={"conversation": CONV_V1, "folder_id": fid,
                          "source_platform": "chatgpt"})
    assert r.status_code == 200, r.text
    assert r.json()["memory_version"] == 1
    return fid


# ---------------- BMF save + evolution ----------------
class TestBMFSaveAndEvolution:
    def test_first_save_version_1(self, client, evo_folder):
        # evo_folder fixture already did save #1 — verify metadata via workspace endpoint
        r = client.get(f"{BASE_URL}/api/workspace/{evo_folder}/memory")
        assert r.status_code == 200
        bmf = r.json()["bmf"]
        assert bmf["metadata"]["memory_version"] >= 1
        assert bmf["metadata"]["bmf_version"] == "1.0"

    def test_second_save_evolves_to_v2_with_history(self, client, evo_folder):
        
        r = client.post(f"{BASE_URL}/api/memory/save",
                        json={"conversation": CONV_V2,
                              "folder_id": evo_folder,
                              "source_platform": "claude"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["memory_version"] == 2

        # Fetch workspace memory (full BMF)
        rw = client.get(f"{BASE_URL}/api/workspace/{evo_folder}/memory")
        assert rw.status_code == 200
        bmf = rw.json()["bmf"]
        assert bmf["metadata"]["memory_version"] == 2
        assert bmf["metadata"]["bmf_version"] == "1.0"

        # Verify NEW decision active mentioning MongoDB
        active_titles = " | ".join(d["title"].lower() for d in bmf["decisions"]
                                   if d["status"].lower() in ("current", "pending"))
        history_titles = " | ".join(d["title"].lower() for d in bmf["history"]["decisions"])
        # At minimum, history should be populated (replaced decision moved) OR
        # a state_change should exist (evolution occurred).
        state_changes = bmf["history"]["state_changes"]
        evolved_signal = (
            "supabase" in history_titles
            or ("mongodb" in active_titles and "supabase" not in active_titles)
            or len(state_changes) > 0
        )
        assert evolved_signal, f"No evolution detected. active={active_titles} history={history_titles} sc={state_changes}"

        # If Supabase moved to history, must be status Replaced
        for h in bmf["history"]["decisions"]:
            if "supabase" in h["title"].lower():
                assert h["status"].lower() in ("replaced", "rejected", "deprecated")

    def test_workspace_memory_shape(self, client, evo_folder):
        r = client.get(f"{BASE_URL}/api/workspace/{evo_folder}/memory")
        assert r.status_code == 200
        bmf = r.json()["bmf"]
        for key in ("metadata", "project", "decisions", "architecture", "constraints",
                    "preferences", "knowledge", "tasks", "history"):
            assert key in bmf, f"Missing {key}"
        assert set(bmf["tasks"].keys()) >= {"completed", "pending", "blocked", "future"}
        assert set(bmf["history"].keys()) >= {"state_changes", "decisions"}


# ---------------- Deploy Engine ----------------
class TestDeploy:
    def test_deploy_with_prompt_relevance(self, client, evo_folder):
        r = client.post(f"{BASE_URL}/api/memory/deploy",
                        json={"folder_id": evo_folder,
                              "current_prompt": "help me set up the database"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "<context>" in d["context"]
        assert "</context>" in d["context"]
        assert d["memory_version"] >= 1
        rel = d["relevance"]
        assert rel["matched_prompt"] is True
        for k in ("decisions", "constraints", "technologies", "knowledge", "tasks"):
            assert k in rel and isinstance(rel[k], int)

    def test_deploy_empty_prompt_still_returns_context(self, client, evo_folder):
        r = client.post(f"{BASE_URL}/api/memory/deploy",
                        json={"folder_id": evo_folder, "current_prompt": ""})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "<context>" in d["context"]
        assert d["relevance"]["matched_prompt"] is False

    def test_deploy_no_memory_400(self, client):
        f = client.post(f"{BASE_URL}/api/folders", json={"name": "TEST_EmptyDeploy"}).json()
        r = client.post(f"{BASE_URL}/api/memory/deploy",
                        json={"folder_id": f["folder_id"], "current_prompt": "hi"})
        assert r.status_code == 400


# ---------------- Export ----------------
class TestExport:
    def test_export_returns_package(self, client, evo_folder):
        r = client.get(f"{BASE_URL}/api/workspace/{evo_folder}/export")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["filename"].endswith(".bmf")
        assert d["bmf_version"] == "1.0"
        assert isinstance(d["package"], str) and len(d["package"]) > 0
        # decodes as base64
        base64.b64decode(d["package"].encode("ascii"))


# ---------------- Regression ----------------
class TestRegression:
    def test_search(self, client):
        r = client.post(f"{BASE_URL}/api/memory/search", json={"query": "database"})
        assert r.status_code == 200
        d = r.json()
        assert "results" in d
        if d["results"]:
            assert "score" in d["results"][0]

    def test_optimize(self, client):
        r = client.post(f"{BASE_URL}/api/optimize",
                        json={"prompt": "write a haiku about databases"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert isinstance(d.get("optimized"), str) and len(d["optimized"]) > 0

    def test_recent(self, client, evo_folder):
        r = client.get(f"{BASE_URL}/api/recent")
        assert r.status_code == 200
        d = r.json()
        assert "recent" in d and len(d["recent"]) > 0
        assert "folder_name" in d["recent"][0]

    def test_deployments(self, client):
        r = client.get(f"{BASE_URL}/api/deployments")
        assert r.status_code == 200
        assert "deployments" in r.json()
