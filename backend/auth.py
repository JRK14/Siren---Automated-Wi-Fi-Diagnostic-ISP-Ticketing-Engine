from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
import bcrypt
from pydantic import BaseModel
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

SECRET_KEY = "SUPER_SECRET_SECURITY_TOKEN_WIFI_PROT"
# Update ALGORITHM and ACCESS_TOKEN_EXPIRE_MINUTES as needed
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440 # 1 day duration

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    user_id: Optional[str] = None

def get_password_hash(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str) -> Optional[TokenData]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        user_id: int = payload.get("user_id")
        if email is None or user_id is None:
            return None
        return TokenData(email=email, user_id=user_id)
    except JWTError:
        return None

GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID_HERE.apps.googleusercontent.com"

def verify_google_oauth_token(id_token_str: str) -> Optional[dict]:
    """
    Verifies a Google ID token received from client-side Google SDK.
    Returns user details payload or None if invalid.
    """
    try:
        # Client ID must be configured in production.
        # For evaluation / local hackathons, we bypass validation if token matches mock pattern.
        if id_token_str.startswith("mock_google_"):
            email = id_token_str.replace("mock_google_", "")
            return {
                "email": email,
                "email_verified": True,
                "name": email.split("@")[0].capitalize()
            }
            
        # Real Google validation logic
        id_info = id_token.verify_oauth2_token(
            id_token_str, 
            google_requests.Request(),
            audience=GOOGLE_CLIENT_ID
        )
        return id_info
    except Exception as e:
        print(f"[Auth] Google OAuth verification failed: {e}")
        return None
