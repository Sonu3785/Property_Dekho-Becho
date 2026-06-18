from fastapi import APIRouter, HTTPException

from app.database import supabase
from app import schemas, auth

router = APIRouter(
    prefix="/users",
    tags=["Users"]
)


@router.post("/register")
def register(user: schemas.UserCreate):
    try:
        existing = (
            supabase
            .table("users")
            .select("id")
            .eq("email", user.email)
            .execute()
        )

        if existing.data:
            raise HTTPException(status_code=400, detail="Email already registered")

        hashed_password = auth.hash_password(user.password)

        response = (
            supabase
            .table("users")
            .insert({
                "name": user.name,
                "email": user.email,
                "password": hashed_password
            })
            .execute()
        )

        return {
            "message": "User registered successfully",
            "data": response.data
        }

    except HTTPException:
        raise
    except Exception as e:
        print("REGISTER ERROR:", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/login")
def login(user: schemas.UserLogin):
    try:
        response = (
            supabase
            .table("users")
            .select("*")
            .eq("email", user.email)
            .execute()
        )

        if not response.data:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        db_user = response.data[0]

        if not auth.verify_password(user.password, db_user["password"]):
            raise HTTPException(status_code=401, detail="Invalid credentials")

        token = auth.create_access_token({"user_id": db_user["id"]})

        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": db_user["id"],
                "name": db_user["name"],
                "email": db_user["email"]
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print("LOGIN ERROR:", str(e))
        raise HTTPException(status_code=500, detail=str(e))
        
@router.get("/show")
def get_users():

    response = (
        supabase
        .table("users")
        .select("*")
        .execute()
    )

    return response.data