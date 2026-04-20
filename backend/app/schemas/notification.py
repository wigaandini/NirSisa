from __future__ import annotations
from pydantic import BaseModel, Field


class RegisterTokenRequest(BaseModel):
    expo_push_token: str = Field(description="Expo Push Token dari device, format: ExponentPushToken[xxx]")
    device_info: str | None = Field(default=None, description="Info device, misal: iPhone 15 / Pixel 8")


class NotificationItem(BaseModel):
    id: str
    notification_type: str
    title: str | None
    body: str | None
    sent_at: str
    is_read: bool
    inventory_stock_id: str | None = None


class NotificationListResponse(BaseModel):
    total: int
    unread_count: int
    notifications: list[NotificationItem]
