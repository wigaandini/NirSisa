# Notification API Endpoints
# - Registrasi device token untuk push notification
# - Riwayat notifikasi user
# - Tandai notifikasi sudah dibaca
# - Manual trigger expiry check (untuk testing)

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.auth import get_current_user_id
from app.schemas.notification import (
    RegisterTokenRequest,
    NotificationListResponse,
)
from app.services.notification_service import (
    register_device_token,
    unregister_device_token,
    get_user_notifications,
    mark_notification_read,
    mark_all_read,
)
from app.tasks.expiry_checker import check_and_notify

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.post("/token")
async def register_token(
    body: RegisterTokenRequest,
    user_id: str = Depends(get_current_user_id),
):
    """Simpan Expo Push Token untuk menerima notifikasi."""
    if not body.expo_push_token.startswith("ExponentPushToken["):
        raise HTTPException(
            status_code=400,
            detail="Format token tidak valid. Harus dimulai dengan 'ExponentPushToken['.",
        )

    result = register_device_token(
        user_id=user_id,
        expo_push_token=body.expo_push_token,
        device_info=body.device_info,
    )
    return result


@router.delete("/token")
async def unregister_token(
    expo_push_token: str = Query(description="Token yang akan dihapus"),
    _: str = Depends(get_current_user_id),
):
    """Nonaktifkan push token (misal saat logout)."""
    unregister_device_token(expo_push_token)
    return {"status": "deactivated"}


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    user_id: str = Depends(get_current_user_id),
):
    """Ambil riwayat notifikasi user."""
    return get_user_notifications(user_id, limit=limit, offset=offset)


@router.patch("/{notification_id}/read")
async def read_notification(
    notification_id: str,
    user_id: str = Depends(get_current_user_id),
):
    """Tandai satu notifikasi sebagai sudah dibaca."""
    mark_notification_read(notification_id, user_id)
    return {"status": "read"}


@router.patch("/read-all")
async def read_all_notifications(
    user_id: str = Depends(get_current_user_id),
):
    """Tandai semua notifikasi user sebagai sudah dibaca."""
    count = mark_all_read(user_id)
    return {"status": "ok", "marked_read": count}


@router.post("/check-expiry", tags=["Admin"])
async def trigger_expiry_check(
    _: str = Depends(get_current_user_id),
):
    """Manual trigger expiry checker (untuk testing). Di produksi berjalan otomatis via scheduler."""
    try:
        result = check_and_notify()
        return result
    except Exception as e:
        logger.error("Manual expiry check failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
