# Expiry Checker — Background Job
# Memindai inventory semua user, mendeteksi bahan yang mendekati kedaluwarsa,
# dan mengirim push notification via Expo Push API.
#
# Jadwal: dijalankan oleh APScheduler setiap hari pukul 07:00 WIB (00:00 UTC)
# Threshold: ≤ 2 hari = critical, 3-5 hari = warning

from __future__ import annotations

import logging
from datetime import date

from app.core.supabase import get_supabase
from app.services.notification_service import (
    get_all_users_with_tokens,
    send_expo_push,
    log_notification,
)

logger = logging.getLogger(__name__)

CRITICAL_DAYS = 2   # merah: ≤ 2 hari
WARNING_DAYS = 5    # kuning: 3–5 hari
PAGE_SIZE = 1000


def _fetch_expiring_items() -> list[dict]:
    """Ambil semua inventory item yang expiry_date ≤ WARNING_DAYS dari hari ini."""
    sb = get_supabase()
    today = date.today()
    all_items: list[dict] = []
    offset = 0

    while True:
        result = (
            sb.table("inventory_stock")
            .select("id, user_id, item_name, item_name_normalized, expiry_date, quantity")
            .gt("quantity", 0)
            .not_.is_("expiry_date", "null")
            .order("expiry_date")
            .range(offset, offset + PAGE_SIZE - 1)
            .execute()
        )
        batch = result.data or []
        if not batch:
            break
        all_items.extend(batch)
        if len(batch) < PAGE_SIZE:
            break
        offset += PAGE_SIZE

    # Filter: hanya yang ≤ WARNING_DAYS
    expiring = []
    for item in all_items:
        exp = item.get("expiry_date")
        if not exp:
            continue
        days_left = (date.fromisoformat(exp) - today).days
        if days_left <= WARNING_DAYS:
            item["days_remaining"] = days_left
            expiring.append(item)

    return expiring


def _group_by_user(items: list[dict]) -> dict[str, dict]:
    """Kelompokkan item per user_id, pisahkan critical vs warning."""
    users: dict[str, dict] = {}

    for item in items:
        uid = item["user_id"]
        if uid not in users:
            users[uid] = {"critical": [], "warning": []}

        days = item["days_remaining"]
        name = item.get("item_name_normalized") or item.get("item_name", "Bahan")

        entry = {
            "stock_id": item["id"],
            "name": name,
            "days": days,
            "quantity": item.get("quantity", 0),
        }

        if days <= CRITICAL_DAYS:
            users[uid]["critical"].append(entry)
        else:
            users[uid]["warning"].append(entry)

    return users


def _build_notification_text(
    items: list[dict],
    level: str,
) -> tuple[str, str]:
    """Bangun title dan body notifikasi berdasarkan level dan daftar bahan."""
    names = [i["name"] for i in items[:5]]  # max 5 bahan ditampilkan
    remaining = len(items) - len(names)

    if level == "critical":
        title = "⚠️ Bahan Segera Kedaluwarsa!"
        if len(items) == 1:
            i = items[0]
            if i["days"] <= 0:
                body = f"{i['name'].title()} sudah melewati batas kedaluwarsa. Segera periksa kondisi fisiknya."
            else:
                body = f"{i['name'].title()} akan kedaluwarsa dalam {i['days']} hari. Buka NirSisa untuk rekomendasi resep."
        else:
            nama_list = ", ".join(n.title() for n in names)
            if remaining > 0:
                nama_list += f" (+{remaining} lainnya)"
            body = f"{nama_list} mendekati kedaluwarsa. Segera masak sebelum terlambat!"
    else:
        title = "📋 Pengingat Stok Bahan"
        nama_list = ", ".join(n.title() for n in names)
        if remaining > 0:
            nama_list += f" (+{remaining} lainnya)"
        body = f"{nama_list} akan kedaluwarsa dalam beberapa hari. Rencanakan menu Anda."

    return title, body


def check_and_notify() -> dict:
    """
    Main job: scan inventory → deteksi bahan expiring → kirim push notification.
    Dipanggil oleh scheduler atau manual via API.
    """
    logger.info("=== Expiry Checker: mulai scanning ===")

    # 1. Fetch semua item yang mendekati kedaluwarsa
    expiring = _fetch_expiring_items()
    logger.info("  Ditemukan %d item expiring (≤ %d hari)", len(expiring), WARNING_DAYS)

    if not expiring:
        logger.info("  Tidak ada bahan yang perlu dinotifikasi.")
        return {"scanned": 0, "notified_users": 0, "notifications_sent": 0}

    # 2. Kelompokkan per user
    user_groups = _group_by_user(expiring)
    logger.info("  %d user memiliki bahan expiring", len(user_groups))

    # 3. Ambil device tokens
    user_tokens = get_all_users_with_tokens()
    logger.info("  %d user memiliki device tokens aktif", len(user_tokens))

    notified_users = 0
    notifications_sent = 0

    # 4. Kirim notifikasi per user
    for user_id, groups in user_groups.items():
        tokens = user_tokens.get(user_id, [])
        if not tokens:
            continue

        # Critical notification
        if groups["critical"]:
            title, body = _build_notification_text(groups["critical"], "critical")
            tickets = send_expo_push(tokens, title, body, data={"type": "expiry_critical"})
            delivered = any(t.get("status") == "ok" for t in tickets)

            # Log satu notifikasi per user (bukan per item)
            stock_id = groups["critical"][0]["stock_id"] if len(groups["critical"]) == 1 else None
            log_notification(
                user_id=user_id,
                notification_type="expiry_critical",
                title=title,
                body=body,
                delivered=delivered,
                inventory_stock_id=stock_id,
            )
            notifications_sent += 1

        # Warning notification (hanya jika TIDAK ada critical, agar tidak spam)
        if groups["warning"] and not groups["critical"]:
            title, body = _build_notification_text(groups["warning"], "warning")
            tickets = send_expo_push(tokens, title, body, data={"type": "expiry_warning"})
            delivered = any(t.get("status") == "ok" for t in tickets)

            stock_id = groups["warning"][0]["stock_id"] if len(groups["warning"]) == 1 else None
            log_notification(
                user_id=user_id,
                notification_type="expiry_warning",
                title=title,
                body=body,
                delivered=delivered,
                inventory_stock_id=stock_id,
            )
            notifications_sent += 1

        notified_users += 1

    logger.info(
        "=== Expiry Checker selesai: %d item, %d user notified, %d notifications ===",
        len(expiring), notified_users, notifications_sent,
    )

    return {
        "scanned": len(expiring),
        "notified_users": notified_users,
        "notifications_sent": notifications_sent,
    }
