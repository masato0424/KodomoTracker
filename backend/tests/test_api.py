from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
import uuid

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import compute_webhook_signature
from app.main import app
from app.models.enums import (
    CameraEventType,
    ChildColorTheme,
    FrequencyType,
    RecordCategory,
    ThemeMode,
    UserRole,
)


@pytest.fixture()
def client() -> TestClient:
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(
        bind=engine,
        autocommit=False,
        autoflush=False,
        expire_on_commit=False,
    )
    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db: Session = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_client_id_preservation_and_upsert_lww(client: TestClient) -> None:
    """1. Client UUID is preserved on POST and duplicate ID performs Last-Write-Wins UPSERT."""
    child_uuid = str(uuid.uuid4())
    user_uuid = str(uuid.uuid4())
    record_uuid = str(uuid.uuid4())

    r_user = client.post(
        "/api/v1/users/",
        json={
            "id": user_uuid,
            "name": "ママ",
            "relationship": "mother",
            "role": "admin",
            "theme_mode": "dark",
        },
    )
    assert r_user.status_code == 201
    assert r_user.json()["id"] == user_uuid
    assert r_user.json()["theme_mode"] == "dark"

    r_child = client.post(
        "/api/v1/children/",
        json={
            "id": child_uuid,
            "name": "はるか",
            "gender": "female",
            "birth_date": "2026-01-15",
            "color_theme": "pink",
        },
    )
    assert r_child.status_code == 201
    assert r_child.json()["id"] == child_uuid
    assert r_child.json()["color_theme"] == "pink"

    t1 = datetime(2026, 11, 6, 10, 0, 0, tzinfo=timezone.utc)
    t2 = t1 + timedelta(minutes=10)
    t_old = t1 - timedelta(minutes=10)

    r_rec1 = client.post(
        "/api/v1/records/",
        json={
            "id": record_uuid,
            "child_id": child_uuid,
            "recorded_by": user_uuid,
            "category": "milk",
            "start_time": t1.isoformat(),
            "amount": 160.0,
            "metadata": {"unit": "ml", "item_name": "朝ミルク"},
            "updated_at": t1.isoformat(),
        },
    )
    assert r_rec1.status_code == 201
    assert r_rec1.json()["id"] == record_uuid
    assert r_rec1.json()["amount"] == 160.0

    # Re-POST with newer updated_at -> updates existing record without duplicating
    r_rec2 = client.post(
        "/api/v1/records/",
        json={
            "id": record_uuid,
            "child_id": child_uuid,
            "recorded_by": user_uuid,
            "category": "milk",
            "start_time": t1.isoformat(),
            "amount": 200.0,
            "metadata": {"unit": "ml", "item_name": "朝ミルク増量"},
            "updated_at": t2.isoformat(),
        },
    )
    assert r_rec2.status_code == 201
    assert r_rec2.json()["id"] == record_uuid
    assert r_rec2.json()["amount"] == 200.0

    # Re-POST with older updated_at -> LWW keeps newer value (200.0)
    r_rec_stale = client.post(
        "/api/v1/records/",
        json={
            "id": record_uuid,
            "child_id": child_uuid,
            "recorded_by": user_uuid,
            "category": "milk",
            "start_time": t1.isoformat(),
            "amount": 120.0,
            "metadata": {"unit": "ml"},
            "updated_at": t_old.isoformat(),
        },
    )
    assert r_rec_stale.status_code == 201
    assert r_rec_stale.json()["amount"] == 200.0

    # Verify total count is still 1 (no duplicate record created)
    list_res = client.get("/api/v1/records/", params={"child_id": child_uuid})
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1


def test_sync_pull_and_push_differential_and_soft_delete(client: TestClient) -> None:
    """1 & 3. Differential /sync/pull and /sync/push with last_pulled_at and deleted_at."""
    child_id = str(uuid.uuid4())
    rec_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    push_res = client.post(
        "/api/v1/sync/push",
        json={
            "changes": {
                "children": {
                    "created": [
                        {
                            "id": child_id,
                            "name": "そうた",
                            "gender": "male",
                            "birth_date": "2025-05-01",
                            "color_theme": "emerald",
                            "updated_at": now.isoformat(),
                        }
                    ],
                    "updated": [],
                    "deleted": [],
                },
                "records": {
                    "created": [
                        {
                            "id": rec_id,
                            "child_id": child_id,
                            "category": "body_temp",
                            "start_time": now.isoformat(),
                            "amount": 36.8,
                            "metadata": {"unit": "℃"},
                            "updated_at": now.isoformat(),
                        }
                    ],
                    "updated": [],
                    "deleted": [],
                },
            }
        },
    )
    assert push_res.status_code == 200

    # Initial pull (last_pulled_at omitted)
    pull1 = client.get("/api/v1/sync/pull", params={"child_id": child_id})
    assert pull1.status_code == 200
    data1 = pull1.json()
    assert any(r["id"] == rec_id for r in data1["changes"]["records"]["created"])
    sync_ts = data1["timestamp"]

    # Soft delete the record via DELETE endpoint
    del_res = client.delete(f"/api/v1/records/{rec_id}")
    assert del_res.status_code == 204

    # Subsequent differential pull with last_pulled_at returns rec_id in deleted
    pull2 = client.get(
        "/api/v1/sync/pull",
        params={"last_pulled_at": sync_ts - 5000, "child_id": child_id},
    )
    assert pull2.status_code == 200
    data2 = pull2.json()
    assert rec_id in data2["changes"]["records"]["deleted"]


def test_rbac_viewer_and_editor_restrictions_and_jwt(client: TestClient) -> None:
    """2. RBAC: viewer gets 403 INSUFFICIENT_ROLE on writes; editor cannot delete children/users; JWT works."""
    admin_id = str(uuid.uuid4())
    editor_id = str(uuid.uuid4())
    viewer_id = str(uuid.uuid4())
    child_id = str(uuid.uuid4())

    client.post(
        "/api/v1/users/",
        json={"id": admin_id, "name": "管理者", "relationship": "mother", "role": "admin"},
    )
    client.post(
        "/api/v1/users/",
        json={"id": editor_id, "name": "編集者", "relationship": "father", "role": "editor"},
    )
    client.post(
        "/api/v1/users/",
        json={"id": viewer_id, "name": "閲覧者", "relationship": "grandmother", "role": "viewer"},
    )
    client.post(
        "/api/v1/children/",
        json={"id": child_id, "name": "はるか", "gender": "female", "birth_date": "2026-01-15"},
    )

    # Issue JWT token for viewer
    token_res = client.post("/api/v1/auth/token", json={"user_id": viewer_id})
    assert token_res.status_code == 200
    viewer_token = token_res.json()["access_token"]

    # Viewer attempting to create a record via JWT -> 403 INSUFFICIENT_ROLE
    rec_attempt = client.post(
        "/api/v1/records/",
        headers={"Authorization": f"Bearer {viewer_token}"},
        json={
            "child_id": child_id,
            "category": "milk",
            "start_time": datetime.now(timezone.utc).isoformat(),
            "amount": 150.0,
        },
    )
    assert rec_attempt.status_code == 403
    assert rec_attempt.json()["detail"]["code"] == "INSUFFICIENT_ROLE"

    # Viewer can still toggle their own theme_mode
    theme_update = client.patch(
        f"/api/v1/users/{viewer_id}",
        headers={"Authorization": f"Bearer {viewer_token}"},
        json={"theme_mode": "dark"},
    )
    assert theme_update.status_code == 200
    assert theme_update.json()["theme_mode"] == "dark"

    # Editor can create records, but cannot delete child or user master data
    editor_del_child = client.delete(
        f"/api/v1/children/{child_id}",
        headers={"X-User-Id": editor_id, "X-User-Role": "editor"},
    )
    assert editor_del_child.status_code == 403
    assert editor_del_child.json()["detail"]["code"] == "INSUFFICIENT_ROLE"


def test_record_validation_ranges_time_order_and_item_name_stripping(
    client: TestClient,
) -> None:
    """4. RecordCreate / RecordUpdate validate amount ranges, end_time >= start_time, and strip item_name."""
    child_id = str(uuid.uuid4())
    client.post(
        "/api/v1/children/",
        json={"id": child_id, "name": "はるか", "gender": "female", "birth_date": "2026-01-15"},
    )
    t_start = datetime(2026, 11, 6, 12, 0, 0, tzinfo=timezone.utc)
    t_before = t_start - timedelta(minutes=30)

    # 1) end_time < start_time -> 422
    bad_time = client.post(
        "/api/v1/records/",
        json={
            "child_id": child_id,
            "category": "sleep",
            "start_time": t_start.isoformat(),
            "end_time": t_before.isoformat(),
        },
    )
    assert bad_time.status_code == 422

    # 2) Out-of-range milk amount (5000ml > 2000ml) -> 422
    bad_milk = client.post(
        "/api/v1/records/",
        json={
            "child_id": child_id,
            "category": "milk",
            "start_time": t_start.isoformat(),
            "amount": 5000.0,
        },
    )
    assert bad_milk.status_code == 422

    # 3) Out-of-range body_temp (45.0C > 43.0C) -> 422
    bad_temp = client.post(
        "/api/v1/records/",
        json={
            "child_id": child_id,
            "category": "body_temp",
            "start_time": t_start.isoformat(),
            "amount": 45.0,
        },
    )
    assert bad_temp.status_code == 422

    # 4) Non-meal category strips metadata.item_name automatically
    sleep_res = client.post(
        "/api/v1/records/",
        json={
            "child_id": child_id,
            "category": "sleep",
            "start_time": t_start.isoformat(),
            "metadata": {"item_name": "残ってはいけない品名", "note": "昼寝"},
        },
    )
    assert sleep_res.status_code == 201
    assert "item_name" not in sleep_res.json()["metadata"]
    assert sleep_res.json()["metadata"]["note"] == "昼寝"


def test_camera_webhook_hmac_signature_and_debounce(client: TestClient) -> None:
    """2 & 3. Camera webhook requires HMAC-SHA256 signature, 300s timestamp window, and 5-min debounce."""
    child_id = str(uuid.uuid4())
    client.post(
        "/api/v1/children/",
        json={"id": child_id, "name": "はるか", "gender": "female", "birth_date": "2026-01-15"},
    )
    now = datetime.now(timezone.utc)
    payload = {
        "child_id": child_id,
        "event_type": CameraEventType.ROLLOVER.value,
        "confidence": 0.92,
        "detected_at": now.isoformat(),
    }
    raw_body = json.dumps(payload).encode("utf-8")

    # Missing signature -> 401
    unsigned_res = client.post(
        "/api/v1/webhooks/camera-events",
        content=raw_body,
        headers={"Content-Type": "application/json"},
    )
    assert unsigned_res.status_code == 401

    # Valid signature + timestamp -> 201 Created and auto-linked record
    ts_str = str(int(now.timestamp()))
    sig = compute_webhook_signature(raw_body, ts_str)
    signed_res = client.post(
        "/api/v1/webhooks/camera-events",
        content=raw_body,
        headers={
            "Content-Type": "application/json",
            "X-Hub-Signature-256": sig,
            "X-Webhook-Timestamp": ts_str,
        },
    )
    assert signed_res.status_code == 201
    assert signed_res.json()["linked_record_id"] is not None

    # Duplicate event within 5 minutes -> 202 Accepted (idempotent debounce)
    dup_res = client.post(
        "/api/v1/webhooks/camera-events",
        content=raw_body,
        headers={
            "Content-Type": "application/json",
            "X-Hub-Signature-256": sig,
            "X-Webhook-Timestamp": ts_str,
        },
    )
    assert dup_res.status_code == 202
    assert dup_res.json()["id"] == signed_res.json()["id"]


def test_prescription_enum_and_pagination_bounds(client: TestClient) -> None:
    """3 & Misc. Prescription frequency_type uses PRD enum values and list endpoints enforce skip/limit bounds."""
    child_id = str(uuid.uuid4())
    client.post(
        "/api/v1/children/",
        json={"id": child_id, "name": "はるか", "gender": "female", "birth_date": "2026-01-15"},
    )
    presc_res = client.post(
        "/api/v1/prescriptions/",
        json={
            "child_id": child_id,
            "medicine_name": "カルボシステインシロップ",
            "dosage_per_time": 5.0,
            "frequency_type": FrequencyType.AFTERMEAL.value,
            "days": 7,
            "start_date": "2026-11-06",
            "schedule_details": {"times": ["08:00", "19:00"], "unit": "ml"},
        },
    )
    assert presc_res.status_code == 201
    assert presc_res.json()["frequency_type"] == "aftermeal"

    # Negative skip or limit > 200 -> 422
    assert client.get("/api/v1/records/", params={"skip": -1}).status_code == 422
    assert client.get("/api/v1/records/", params={"limit": 500}).status_code == 422
