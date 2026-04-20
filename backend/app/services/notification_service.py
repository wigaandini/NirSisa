# Notification Service
# Mengelola device token, pengiriman push notification via Expo Push API,
# dan pencatatan log notifikasi.

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

import httpx

from app.core.supabase import get_supabase

logger = logging.getLogger(__name__)

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
EXPO_PUSH_TIMEOUT = 15  # detik


# ═══════════════════════════════════════════════════════════════════════════════
# DEVICE TOKEN MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════════

def register_device_token(
    user_id: str,
    expo_push_token: str,
    device_info: str | None = None,
) -> dict[str, Any]:
    sb = get_supabase()

    # Upsert: jika token sudah ada, update user_id dan activate
    existing = (
        sb.table("device_tokens")
        .select("id, user_id")
        .eq("fcm_token", expo_push_token)
        .execute()
    )

    if existing.data:
        row = existing.data[0]
        sb.table("device_tokens").update({
            "user_id": user_id,
            "device_info": device_info,
            "is_active": True,
            "updated_at": datetime.utcnow().isoformat(),
        }).eq("id", row["id"]).execute()
        logger.info("Token updated for user %s", user_id)
        return {"status": "updated", "token_id": row["id"]}

    result = sb.table("device_tokens").insert({
        "user_id": user_id,
        "fcm_token": expo_push_token,
        "device_info": device_info,
        "is_active": True,
    }).execute()

    token_id = result.data[0]["id"] if result.data else None
    logger.info("Token registered for user %s: %s", user_id, token_id)
    return {"status": "registered", "token_id": token_id}


def unregister_device_token(expo_push_token: str) -> bool:
    sb = get_supabase()
    sb.table("device_tokens").update({
        "is_active": False,
        "updated_at": datetime.utcnow().isoformat(),
    }).eq("fcm_token", expo_push_token).execute()
    logger.info("Token deactivated: %s...", expo_push_token[:20])
    return True


def get_active_tokens_for_user(user_id: str) -> list[str]:
    sb = get_supabase()
    result = (
        sb.table("device_tokens")
        .select("fcm_token")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute()
    )
    return [row["fcm_token"] for row in (result.data or [])]


def get_all_users_with_tokens() -> dict[str, list[str]]:
    """Return {user_id: [token1, token2, ...]} untuk semua user aktif."""
    sb = get_supabase()
    result = (
        sb.table("device_tokens")
        .select("user_id, fcm_token")
        .eq("is_active", True)
        .execute()
    )
    user_tokens: dict[str, list[str]] = {}
    for row in (result.data or []):
        uid = row["user_id"]
        user_tokens.setdefault(uid, []).append(row["fcm_token"])
    return user_tokens


# ═══════════════════════════════════════════════════════════════════════════════
# EXPO PUSH API
# ═══════════════════════════════════════════════════════════════════════════════

def send_expo_push(
    tokens: list[str],
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
) -> list[dict]:
    """Kirim push notification via Expo Push API. Mendukung batch."""
    if not tokens:
        return []

    messages = [
        {
            "to": token,
            "sound": "default",
            "title": title,
            "body": body,
            "data": data or {},
        }
        for token in tokens
    ]

    try:
        with httpx.Client(timeout=EXPO_PUSH_TIMEOUT) as client:
            response = client.post(
                EXPO_PUSH_URL,
                json=messages,
                headers={"Content-Type": "application/json"},
            )
            response.raise_for_status()
            result = response.json()
            tickets = result.get("data", [])
            logger.info(
                "Expo push sent: %d messages, %d tickets",
                len(messages), len(tickets),
            )
            return tickets

    except httpx.HTTPStatusError as e:
        logger.error("Expo Push HTTP error %d: %s", e.response.status_code, e.response.text)
        return []
    except Exception as e:
        logger.error("Expo Push failed: %s", e)
        return []


# ═══════════════════════════════════════════════════════════════════════════════
# NOTIFICATION LOG
# ═══════════════════════════════════════════════════════════════════════════════

def log_notification(
    user_id: str,
    notification_type: str,
    title: str,
    body: str,
    delivered: bool = True,
    inventory_stock_id: str | None = None,
) -> str | None:
    sb = get_supabase()
    row: dict[str, Any] = {
        "user_id": user_id,
        "notification_type": notification_type,
        "title": title,
        "body": body,
        "delivered": delivered,
        "is_read": False,
        "sent_at": datetime.utcnow().isoformat(),
    }
    if inventory_stock_id:
        row["inventory_stock_id"] = inventory_stock_id

    result = sb.table("notification_log").insert(row).execute()
    return result.data[0]["id"] if result.data else None


def get_user_notifications(
    user_id: str,
    limit: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    sb = get_supabase()

    # Total count
    count_result = (
        sb.table("notification_log")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .execute()
    )
    total = count_result.count or 0

    # Unread count
    unread_result = (
        sb.table("notification_log")
        .select("id", count="exact")
        .eq("user_id", user_id)
        .eq("is_read", False)
        .execute()
    )
    unread = unread_result.count or 0

    # Fetch page
    result = (
        sb.table("notification_log")
        .select("id, notification_type, title, body, sent_at, is_read, inventory_stock_id")
        .eq("user_id", user_id)
        .order("sent_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    return {
        "total": total,
        "unread_count": unread,
        "notifications": result.data or [],
    }


def mark_notification_read(notification_id: str, user_id: str) -> bool:
    sb = get_supabase()
    sb.table("notification_log").update({
        "is_read": True,
    }).eq("id", notification_id).eq("user_id", user_id).execute()
    return True


def mark_all_read(user_id: str) -> int:
    sb = get_supabase()
    result = (
        sb.table("notification_log")
        .update({"is_read": True})
        .eq("user_id", user_id)
        .eq("is_read", False)
        .execute()
    )
    count = len(result.data) if result.data else 0
    logger.info("Marked %d notifications as read for user %s", count, user_id)
    return count
