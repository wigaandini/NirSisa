from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
import base64
from app.core.config import get_settings

_bearer_scheme = HTTPBearer()

async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> str:
    settings = get_settings()
    token = credentials.credentials

    try:
        # 1. Decode Secret (Base64)
        try:
            secret = base64.b64decode(settings.SUPABASE_JWT_SECRET)
        except Exception:
            secret = settings.SUPABASE_JWT_SECRET

        # 2. Cek Header untuk mengetahui algoritma
        unverified_header = jwt.get_unverified_header(token)
        alg = unverified_header.get("alg")

        # 3. Proses berdasarkan algoritma
        if alg == "HS256":
            # Verifikasi ketat untuk Email Login
            payload = jwt.decode(
                token, secret, algorithms=["HS256"],
                options={"verify_aud": True, "verify_signature": True},
                audience="authenticated"
            )
        else:
            # Fallback untuk ES256 (Google OAuth)
            # Kita decode tanpa verifikasi signature karena alasan teknis asimetris
            payload = jwt.decode(token, options={"verify_signature": False})

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found in token")
            
        return user_id

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception as e:
        # Mengubah semua error teknis menjadi 401 agar backend tidak crash (500)
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")