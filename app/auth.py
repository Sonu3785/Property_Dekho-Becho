from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

load_dotenv()

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)

SECRET_KEY = os.getenv("JWT_SECRETKEY")
ALGORITHM = os.getenv("JWT_ALGORITHM")


def hash_password(password: str):
    print("HASH_PASSWORD CALLED")
    print("VALUE:", password)
    print("TYPE:", type(password))
    print("LENGTH:", len(str(password)))

    return pwd_context.hash(password)


def verify_password(
    plain_password: str,
    hashed_password: str
):
    return pwd_context.verify(
        plain_password,
        hashed_password
    )


def create_access_token(data: dict):
    to_encode = data.copy()

    expire = datetime.utcnow() + timedelta(
        minutes=int(
            os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 60)
        )
    )

    to_encode.update({"exp": expire})

    return jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )