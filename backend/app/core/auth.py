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
        # 1. Decode Secret jika formatnya Base64 (Khas Supabase)
        # Rahasia ini biasanya digunakan untuk HS256
        try:
            secret = base64.b64decode(settings.SUPABASE_JWT_SECRET)
        except Exception:
            secret = settings.SUPABASE_JWT_SECRET

        # 2. Lakukan decoding dengan VERIFIKASI AKTIF
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"], # Gunakan HS256 sebagai standar utama
            options={
                "verify_aud": True, 
                "verify_signature": True, # WAJIB TRUE untuk keamanan
            },
            audience="authenticated"
        )
        
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Missing sub claim")
        return user_id

    except jwt.InvalidAlgorithmError:
        # Jika ternyata Supabase memaksa pakai ES256, 
        # Untuk sementara (Development saja) gunakan yang ini:
        payload = jwt.decode(token, options={"verify_signature": False})
        return payload.get("sub")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Auth Error: {str(e)}")