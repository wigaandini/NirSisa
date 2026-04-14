from __future__ import annotations

from datetime import date, datetime
from typing import List

from pydantic import BaseModel, Field


# Input schemas
class InventoryItemCreate(BaseModel):
    # Schema untuk menambah bahan baru ke inventaris
    item_name: str = Field(..., min_length=1, max_length=150, examples=["Bayam"])
    quantity: float = Field(default=1, gt=0, examples=[2.0])
    unit: str = Field(default="buah", max_length=30, examples=["ikat"])
    expiry_date: date | None = Field(default=None, examples=["2026-04-01"])
    is_natural: bool = Field(
        default=False,
        description="True untuk bahan alami (sayur, daging, buah) agar sistem mengestimasi kedaluwarsa otomatis.",
    )
    category_name: str | None = Field(default=None, examples=["Sayuran"])


class InventoryItemUpdate(BaseModel):
    # Schema untuk memperbarui bahan (partial update)
    item_name: str | None = Field(default=None, max_length=150)
    quantity: float | None = Field(default=None, gt=0)
    unit: str | None = Field(default=None, max_length=30)
    expiry_date: date | None = None
    category_name: str | None = None


# Output schemas
class InventoryItemResponse(BaseModel):
    # Response schema untuk satu item inventaris
    id: str
    item_name: str
    item_name_normalized: str | None = None
    category_id: int | None = None
    category_name: str | None = None
    quantity: float
    unit: str | None
    expiry_date: date | None
    is_natural: bool = False
    days_remaining: int | None = None
    spi_score: float | None = None
    freshness_status: str | None = None
    added_at: datetime | None = None
    updated_at: datetime | None = None


# Reconciliation schemas
class IngredientUsage(BaseModel):
    # Satu bahan yang digunakan saat memasak
    item_id: str = Field(..., description="UUID bahan di inventory_stock")
    quantity_used: float = Field(..., gt=0, description="Jumlah yang dipakai")


class ReconciliationRequest(BaseModel):
    """
    Request body untuk konfirmasi selesai masak.

    PERUBAHAN:
    - recipe_id tetap optional
    - ingredients_used sekarang BOLEH kosong
      karena user tetap bisa konfirmasi masak walau tidak semua bahan di stok
      cocok / tervalidasi untuk auto-deduction.
    - Jika kosong, backend hanya mencatat riwayat masak tanpa mengurangi stok.
    """

    recipe_id: int | None = Field(
        default=None,
        description="ID resep di tabel `recipes` (optional). None kalau tidak diketahui.",
    )
    recipe_title: str = Field(..., min_length=1, max_length=300)
    ingredients_used: List[IngredientUsage] = Field(
        default_factory=list,
        description="Daftar bahan yang benar-benar akan dikurangi dari stok. Boleh kosong jika hanya ingin simpan riwayat memasak tanpa auto-deduction.",
    )


class ReconciliationResponse(BaseModel):
    # Response setelah reconciliation berhasil
    status: str
    recipe_title: str
    items_updated: List[dict] = []
    items_removed: List[str] = []